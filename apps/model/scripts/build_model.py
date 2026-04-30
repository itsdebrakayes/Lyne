"""
build_model.py
Runs the full Q ME NOW predictive model pipeline and generates:
  - All visualizations (saved to data_exports/plots/)
  - predictions_output.csv
  - best_time_to_visit.csv
  - branch_performance_summary.csv
  - service_performance_summary.csv

This script mirrors the logic in the Jupyter notebook
05_predictive_model.ipynb and is used for automated runs.
"""

import os
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(BASE, "data_exports")
PLOTS = os.path.join(DATA, "plots")
os.makedirs(PLOTS, exist_ok=True)

print("=" * 60)
print("  Q ME NOW — Predictive Model Pipeline")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — Load & Validate Data
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/7] Loading data …")

df = pd.read_csv(os.path.join(DATA, "queue_history.csv"), parse_dates=["visit_date"])
df_svc = pd.read_csv(os.path.join(DATA, "service_performance.csv"))
df_branch = pd.read_csv(os.path.join(DATA, "branch_performance.csv"), parse_dates=["visit_date"])

print(f"  queue_history     : {len(df):,} rows, {df.columns.tolist()}")
print(f"  service_perf      : {len(df_svc):,} rows")
print(f"  branch_perf       : {len(df_branch):,} rows")

# Basic validation
assert "wait_time_minutes" in df.columns, "Missing wait_time_minutes"
assert "dow" in df.columns, "Missing dow"
assert "hour" in df.columns, "Missing hour"

# Keep only completed/serving for wait-time modeling (exclude no-shows & cancellations)
df_model = df[df["status"].isin(["completed", "serving"])].copy()
df_model["wait_time_minutes"] = pd.to_numeric(df_model["wait_time_minutes"], errors="coerce")
df_model = df_model.dropna(subset=["wait_time_minutes"])
print(f"  Rows for modeling : {len(df_model):,} (completed/serving only)")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — Peak & Off-Peak Hours
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/7] Analysing peak / off-peak hours …")

hourly = (
    df_model.groupby(["business_name", "hour"])
    .agg(avg_wait=("wait_time_minutes", "mean"), volume=("visit_id", "count"))
    .reset_index()
)

# Define peak = top 3 hours by volume per business; off-peak = bottom 3
peak_hours = {}
offpeak_hours = {}
for biz, grp in hourly.groupby("business_name"):
    ranked = grp.sort_values("volume", ascending=False)
    peak_hours[biz]    = ranked.head(3)["hour"].tolist()
    offpeak_hours[biz] = ranked.tail(3)["hour"].tolist()
    print(f"  {biz}: peak={peak_hours[biz]}, off-peak={offpeak_hours[biz]}")

# Plot: hourly volume heatmap (DOW × Hour)
print("  Generating hourly heatmap …")
pivot = df_model.pivot_table(index="dow", columns="hour", values="visit_id",
                              aggfunc="count", fill_value=0)
DOW_MAP = {0:"Mon",1:"Tue",2:"Wed",3:"Thu",4:"Fri",5:"Sat",6:"Sun"}
pivot.index = [DOW_MAP[i] for i in pivot.index]

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(pivot, cmap="YlOrRd", linewidths=0.3, ax=ax,
            cbar_kws={"label": "Ticket Volume"})
ax.set_title("Q ME NOW — Weekly Traffic Heatmap (All Branches)", fontsize=14, fontweight="bold")
ax.set_xlabel("Hour of Day")
ax.set_ylabel("Day of Week")
plt.tight_layout()
plt.savefig(os.path.join(PLOTS, "heatmap_weekly_traffic.png"), dpi=150)
plt.close()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — Fastest & Slowest Services
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/7] Ranking services by speed …")

svc_ranked = df_svc.sort_values("avg_wait_minutes")
print(svc_ranked[["service_name", "business_name", "avg_wait_minutes",
                   "avg_service_minutes", "completion_rate"]].to_string(index=False))

fig, axes = plt.subplots(1, 2, figsize=(14, 6))

# Fastest (lowest avg wait)
fastest = svc_ranked.head(5)
axes[0].barh(fastest["service_name"] + "\n(" + fastest["business_name"].str.split().str[0] + ")",
             fastest["avg_wait_minutes"], color="#22c55e")
axes[0].set_title("5 Fastest Services (Avg Wait)", fontweight="bold")
axes[0].set_xlabel("Avg Wait (minutes)")
axes[0].invert_yaxis()

# Slowest (highest avg wait)
slowest = svc_ranked.tail(5).sort_values("avg_wait_minutes", ascending=False)
axes[1].barh(slowest["service_name"] + "\n(" + slowest["business_name"].str.split().str[0] + ")",
             slowest["avg_wait_minutes"], color="#ef4444")
axes[1].set_title("5 Slowest Services (Avg Wait)", fontweight="bold")
axes[1].set_xlabel("Avg Wait (minutes)")
axes[1].invert_yaxis()

plt.suptitle("Q ME NOW — Service Speed Ranking", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(PLOTS, "service_speed_ranking.png"), dpi=150)
plt.close()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — Branch Performance Trends
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4/7] Analysing branch performance trends …")

# Weekly rolling average wait per branch
df_branch_sorted = df_branch.sort_values(["branch_id", "visit_date"])
df_branch_sorted["rolling_wait"] = (
    df_branch_sorted.groupby("branch_id")["avg_wait_minutes"]
    .transform(lambda x: x.rolling(7, min_periods=1).mean())
)

fig, ax = plt.subplots(figsize=(14, 6))
for branch, grp in df_branch_sorted.groupby("branch_name"):
    ax.plot(grp["visit_date"], grp["rolling_wait"], label=branch, linewidth=1.5)
ax.set_title("Branch Performance Trends — 7-Day Rolling Avg Wait Time", fontsize=13, fontweight="bold")
ax.set_xlabel("Date")
ax.set_ylabel("Avg Wait (minutes)")
ax.legend(loc="upper right", fontsize=7, ncol=2)
plt.tight_layout()
plt.savefig(os.path.join(PLOTS, "branch_performance_trends.png"), dpi=150)
plt.close()

# Completion rate per branch
branch_summary = (
    df_branch.groupby(["branch_id", "branch_name", "business_name"])
    .agg(
        total_visits    = ("total_visits",     "sum"),
        total_completed = ("completed",        "sum"),
        total_no_shows  = ("no_shows",         "sum"),
        avg_wait        = ("avg_wait_minutes",  "mean"),
        avg_queue_len   = ("avg_queue_len",     "mean"),
    )
    .reset_index()
)
branch_summary["completion_rate"] = (
    branch_summary["total_completed"] / branch_summary["total_visits"].clip(lower=1)
).round(4)
branch_summary["no_show_rate"] = (
    branch_summary["total_no_shows"] / branch_summary["total_visits"].clip(lower=1)
).round(4)
branch_summary["avg_wait"] = branch_summary["avg_wait"].round(2)
branch_summary["avg_queue_len"] = branch_summary["avg_queue_len"].round(1)

print(branch_summary[["branch_name", "business_name", "total_visits",
                        "avg_wait", "completion_rate"]].to_string(index=False))

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — Wait Time Prediction Model
# ─────────────────────────────────────────────────────────────────────────────
print("\n[5/7] Training wait-time prediction model …")

# Feature engineering
le_biz  = LabelEncoder()
le_br   = LabelEncoder()
le_svc  = LabelEncoder()

df_model["biz_enc"]  = le_biz.fit_transform(df_model["business_id"])
df_model["br_enc"]   = le_br.fit_transform(df_model["branch_id"])
df_model["svc_enc"]  = le_svc.fit_transform(df_model["service_id"])

FEATURES = ["biz_enc", "br_enc", "svc_enc", "dow", "hour", "month",
            "queue_length_at_join", "staff_count_at_time", "active_counters",
            "is_weekend", "is_holiday"]

X = df_model[FEATURES].fillna(0)
y = df_model["wait_time_minutes"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Baseline: Ridge regression
ridge = Ridge()
ridge.fit(X_train, y_train)
y_pred_ridge = ridge.predict(X_test)
mae_ridge = mean_absolute_error(y_test, y_pred_ridge)
r2_ridge  = r2_score(y_test, y_pred_ridge)
print(f"  Ridge  — MAE: {mae_ridge:.2f} min, R²: {r2_ridge:.4f}")

# Improved: Gradient Boosting
gbr = GradientBoostingRegressor(n_estimators=150, max_depth=5, learning_rate=0.08,
                                 subsample=0.8, random_state=42)
gbr.fit(X_train, y_train)
y_pred_gbr = gbr.predict(X_test)
mae_gbr = mean_absolute_error(y_test, y_pred_gbr)
r2_gbr  = r2_score(y_test, y_pred_gbr)
print(f"  GBR    — MAE: {mae_gbr:.2f} min, R²: {r2_gbr:.4f}")

# Feature importance plot
feat_imp = pd.Series(gbr.feature_importances_, index=FEATURES).sort_values(ascending=True)
fig, ax = plt.subplots(figsize=(9, 5))
feat_imp.plot(kind="barh", ax=ax, color="#6366f1")
ax.set_title("Wait-Time Model — Feature Importance (GBR)", fontweight="bold")
ax.set_xlabel("Importance Score")
plt.tight_layout()
plt.savefig(os.path.join(PLOTS, "feature_importance.png"), dpi=150)
plt.close()

# Actual vs Predicted scatter (sample 2000 points)
sample_idx = np.random.choice(len(y_test), min(2000, len(y_test)), replace=False)
fig, ax = plt.subplots(figsize=(7, 7))
ax.scatter(y_test.iloc[sample_idx], y_pred_gbr[sample_idx],
           alpha=0.3, s=10, color="#6366f1")
lims = [0, max(y_test.max(), y_pred_gbr.max())]
ax.plot(lims, lims, "r--", linewidth=1)
ax.set_xlabel("Actual Wait (min)")
ax.set_ylabel("Predicted Wait (min)")
ax.set_title(f"Actual vs Predicted Wait Time\nMAE={mae_gbr:.2f} min, R²={r2_gbr:.4f}",
             fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(PLOTS, "actual_vs_predicted.png"), dpi=150)
plt.close()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — Best Time to Visit
# ─────────────────────────────────────────────────────────────────────────────
print("\n[6/7] Computing best time to visit …")

DOW_NAMES  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MONTH_NAMES = {1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
               7:"July",8:"August",9:"September",10:"October",11:"November",12:"December"}

best_time_rows = []
generated_at = datetime.utcnow().isoformat()

for biz_id in df_model["business_id"].unique():
    for branch_id in df_model[df_model.business_id == biz_id]["branch_id"].unique():
        sub = df_model[(df_model.business_id == biz_id) & (df_model.branch_id == branch_id)]
        if len(sub) < 30:
            continue

        branch_name  = sub["branch_name"].iloc[0]
        biz_name     = sub["business_name"].iloc[0]

        # Build a grid of all (dow, hour) slots with ≥5 observations
        slot_stats = (
            sub.groupby(["dow", "hour"])
            .agg(
                avg_wait     = ("wait_time_minutes", "mean"),
                volume       = ("visit_id",          "count"),
                p90_wait     = ("wait_time_minutes",  lambda x: x.quantile(0.90)),
            )
            .reset_index()
        )
        slot_stats = slot_stats[slot_stats["volume"] >= 5]

        # Score = low avg_wait + low p90 + low volume (less crowded)
        # Normalise each component to [0,1] then combine
        def norm(s):
            mn, mx = s.min(), s.max()
            return (s - mn) / (mx - mn + 1e-9)

        slot_stats["score"] = (
            (1 - norm(slot_stats["avg_wait"])) * 0.45 +
            (1 - norm(slot_stats["p90_wait"])) * 0.30 +
            (1 - norm(slot_stats["volume"]))   * 0.25
        )

        best_slot    = slot_stats.loc[slot_stats["score"].idxmax()]
        worst_slot   = slot_stats.loc[slot_stats["score"].idxmin()]

        best_dow_name  = DOW_NAMES[int(best_slot["dow"])]
        worst_dow_name = DOW_NAMES[int(worst_slot["dow"])]

        # Best month
        month_stats = sub.groupby("month")["wait_time_minutes"].mean()
        best_month  = MONTH_NAMES[int(month_stats.idxmin())]

        confidence = min(1.0, round(len(sub) / 500, 3))

        recommendation = (
            f"{best_dow_name}s at {int(best_slot['hour'])}:00 in {best_month} "
            f"is predicted as the best time to visit {branch_name}. "
            f"Expected wait: ~{best_slot['avg_wait']:.0f} minutes."
        )

        best_time_rows.append({
            "business_id":           biz_id,
            "business_name":         biz_name,
            "branch_id":             branch_id,
            "branch_name":           branch_name,
            "recommendation_type":   "best_time_to_visit",
            "best_dow":              int(best_slot["dow"]),
            "best_dow_name":         best_dow_name,
            "best_hour":             int(best_slot["hour"]),
            "best_month":            best_month,
            "predicted_wait_minutes":round(float(best_slot["avg_wait"]), 1),
            "p90_wait_minutes":      round(float(best_slot["p90_wait"]), 1),
            "worst_dow_name":        worst_dow_name,
            "worst_hour":            int(worst_slot["hour"]),
            "confidence_score":      confidence,
            "recommendation":        recommendation,
            "generated_at":          generated_at,
        })
        print(f"  {branch_name}: {recommendation}")

df_best = pd.DataFrame(best_time_rows)
df_best.to_csv(os.path.join(DATA, "best_time_to_visit.csv"), index=False)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7 — Export All Prediction Outputs
# ─────────────────────────────────────────────────────────────────────────────
print("\n[7/7] Writing prediction output files …")

# branch_performance_summary.csv
branch_summary.to_csv(os.path.join(DATA, "branch_performance_summary.csv"), index=False)

# service_performance_summary.csv (already exists but add ranking columns)
df_svc_out = df_svc.copy()
df_svc_out["speed_rank"]       = df_svc_out["avg_wait_minutes"].rank(method="min").astype(int)
df_svc_out["reliability_rank"] = df_svc_out["completion_rate"].rank(ascending=False, method="min").astype(int)
df_svc_out.to_csv(os.path.join(DATA, "service_performance_summary.csv"), index=False)

# predictions_output.csv — master file for MySQL import via import_predictions.py
peak_rows = []
for biz_name, hours in peak_hours.items():
    biz_id = df_model[df_model.business_name == biz_name]["business_id"].iloc[0]
    peak_rows.append({
        "business_id":         biz_id,
        "business_name":       biz_name,
        "branch_id":           None,
        "recommendation_type": "peak_hours",
        "insight_data":        json.dumps({
            "peak_hours":    hours,
            "offpeak_hours": offpeak_hours[biz_name],
        }),
        "generated_at":        generated_at,
    })

model_meta_rows = [{
    "business_id":         None,
    "business_name":       "ALL",
    "branch_id":           None,
    "recommendation_type": "model_performance",
    "insight_data":        json.dumps({
        "ridge_mae": round(mae_ridge, 3),
        "ridge_r2":  round(r2_ridge, 4),
        "gbr_mae":   round(mae_gbr, 3),
        "gbr_r2":    round(r2_gbr, 4),
        "training_rows": len(X_train),
        "test_rows":     len(X_test),
    }),
    "generated_at": generated_at,
}]

best_time_export = df_best[["business_id", "branch_id", "recommendation_type",
                             "recommendation", "predicted_wait_minutes",
                             "confidence_score", "generated_at"]].copy()
best_time_export.rename(columns={"recommendation": "insight_data"}, inplace=True)
best_time_export["insight_data"] = best_time_export.apply(
    lambda r: json.dumps({
        "recommendation":        r["insight_data"],
        "predicted_wait_minutes": r["predicted_wait_minutes"],
        "confidence_score":       r["confidence_score"],
    }), axis=1
)
best_time_export.drop(columns=["predicted_wait_minutes", "confidence_score"], inplace=True)
best_time_export["business_name"] = best_time_export["business_id"].map(
    df_model.drop_duplicates("business_id").set_index("business_id")["business_name"]
)

all_predictions = pd.concat([
    best_time_export,
    pd.DataFrame(peak_rows),
    pd.DataFrame(model_meta_rows),
], ignore_index=True)

all_predictions.to_csv(os.path.join(DATA, "predictions_output.csv"), index=False)

print(f"\n  best_time_to_visit.csv          : {len(df_best)} rows")
print(f"  branch_performance_summary.csv  : {len(branch_summary)} rows")
print(f"  service_performance_summary.csv : {len(df_svc_out)} rows")
print(f"  predictions_output.csv          : {len(all_predictions)} rows")
print(f"\n  Plots saved to: {PLOTS}")
print("\n" + "=" * 60)
print("  Pipeline complete.")
print("=" * 60)
