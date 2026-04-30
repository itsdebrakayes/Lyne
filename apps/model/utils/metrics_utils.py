"""
Metrics and scoring utilities for analytics notebooks.
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple


def calculate_z_scores(series: pd.Series) -> pd.Series:
    """Calculate z-scores for a series (ddof=0 for stability)."""
    s = pd.to_numeric(series, errors="coerce")
    mean = s.mean()
    std = s.std(ddof=0)
    if std == 0 or np.isnan(std):
        return pd.Series([0] * len(series), index=series.index)
    return (s - mean) / std


def detect_anomalies(
    df: pd.DataFrame,
    value_col: str,
    date_col: str = "date",
    threshold: float = 2.0
) -> List[Dict[str, Any]]:
    """
    Detect anomalies based on absolute z-score threshold.

    Output matches your ops_insights.json schema:
      {date, metric, value, expected, z_score, severity}
    """
    d = df.copy()
    d[value_col] = pd.to_numeric(d[value_col], errors="coerce")
    d["z_score"] = calculate_z_scores(d[value_col])

    mean_val = float(d[value_col].mean()) if len(d) else 0.0
    anomalies = d[d["z_score"].abs() >= threshold]

    def severity(z: float) -> str:
        if abs(z) >= 3.0:
            return "critical"
        if abs(z) >= 2.0:
            return "warning"
        return "info"

    results: List[Dict[str, Any]] = []
    for _, row in anomalies.iterrows():
        z = float(row["z_score"])
        results.append({
            "date": str(row[date_col]),
            "metric": value_col,
            "value": float(row[value_col]),
            "expected": round(mean_val, 1),
            "z_score": round(z, 2),
            "severity": severity(z)
        })
    return results


def calculate_utilization(busy_time_minutes: float, available_time_minutes: float) -> float:
    """Utilization ratio (0..1+)."""
    if available_time_minutes <= 0:
        return 0.0
    return round(float(busy_time_minutes) / float(available_time_minutes), 3)


def get_utilization_status(utilization: float) -> str:
    """
    Map utilization to your schema labels.
    Your ops schema uses: 'optimal' plus useful statuses.
    """
    if utilization < 0.40:
        return "over_resourced"
    if utilization > 0.85:
        return "under_resourced"
    return "optimal"


def rank_staff(staff_df: pd.DataFrame, score_col: str = "efficiency_score") -> pd.DataFrame:
    """Add ranking to staff DataFrame."""
    df = staff_df.copy()
    df["rank"] = df[score_col].rank(ascending=False, method="min").astype(int)
    return df.sort_values("rank")


def calculate_completion_rate(completed: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(completed / total, 3)


def normalize_0_100(series: pd.Series, higher_is_better: bool = True) -> pd.Series:
    """
    Robust normalization to 0..100 using 5th..95th percentiles.
    Avoids hard-coded max assumptions (more stable across organizations).
    """
    s = pd.to_numeric(series, errors="coerce").fillna(0)
    lo = s.quantile(0.05)
    hi = s.quantile(0.95)
    if hi == lo:
        out = pd.Series([50] * len(s), index=s.index)
    else:
        out = (s.clip(lo, hi) - lo) / (hi - lo) * 100
    if not higher_is_better:
        out = 100 - out
    return out


def calculate_efficiency_score_vectorized(
    df: pd.DataFrame,
    served_col: str,
    avg_service_time_col: str,
    avg_wait_time_col: str,
    completion_rate_col: str,
    weights: Dict[str, float] = None
) -> pd.Series:
    """
    Vectorized staff efficiency score 0..100.
    Uses robust normalization instead of fixed daily caps.
    """
    if weights is None:
        weights = {"served": 0.40, "service_time": 0.25, "wait_time": 0.25, "completion": 0.10}

    served_score = normalize_0_100(df[served_col], higher_is_better=True)
    service_score = normalize_0_100(df[avg_service_time_col], higher_is_better=False)
    wait_score = normalize_0_100(df[avg_wait_time_col], higher_is_better=False)
    completion_score = normalize_0_100(df[completion_rate_col], higher_is_better=True)

    score = (
        weights["served"] * served_score +
        weights["service_time"] * service_score +
        weights["wait_time"] * wait_score +
        weights["completion"] * completion_score
    )
    return score.round(1)
