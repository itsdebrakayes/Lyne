"""
Feature engineering utilities for analytics notebooks.

Note: Your CSV contract already includes dow/hour/is_weekend.
So these helpers should NOT overwrite contract columns unless requested.
"""
import pandas as pd
from typing import List, Dict, Any

DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def get_day_name(dow: int) -> str:
    return DAY_NAMES[dow] if 0 <= int(dow) <= 6 else ""


def ensure_timestamp(df: pd.DataFrame, timestamp_col: str = "timestamp") -> pd.DataFrame:
    df = df.copy()
    df[timestamp_col] = pd.to_datetime(df[timestamp_col], utc=True, errors="coerce")
    if df[timestamp_col].isna().any():
        bad = df[df[timestamp_col].isna()].head(3)
        raise ValueError(f"Invalid timestamps in {timestamp_col}. Examples:\n{bad}")
    return df


def add_date_col(df: pd.DataFrame, timestamp_col: str = "timestamp", out_col: str = "date") -> pd.DataFrame:
    df = ensure_timestamp(df, timestamp_col)
    df = df.copy()
    df[out_col] = df[timestamp_col].dt.date.astype(str)
    return df


def calculate_traffic_by_slot(visits_df: pd.DataFrame) -> pd.DataFrame:
    """
    Average traffic by (dow, hour), averaged over distinct dates.
    Expects visits_df already has: dow, hour, timestamp (or date).
    """
    df = visits_df.copy()
    if "date" not in df.columns:
        df = add_date_col(df, "timestamp", "date")

    slot_daily = df.groupby(["date", "dow", "hour"], as_index=False).agg(traffic=("visit_id", "count"))
    heatmap = slot_daily.groupby(["dow", "hour"], as_index=False).agg(avg_traffic=("traffic", "mean"))
    return heatmap


def identify_peak_slots(traffic_df: pd.DataFrame, top_n: int = 10) -> List[Dict[str, Any]]:
    df = traffic_df.sort_values("avg_traffic", ascending=False).head(top_n).reset_index(drop=True)
    out = []
    for i, row in df.iterrows():
        out.append({
            "dow": int(row["dow"]),
            "dow_name": get_day_name(int(row["dow"])),
            "hour": int(row["hour"]),
            "avg_traffic": float(round(row["avg_traffic"], 1)),
            "rank": int(i + 1)
        })
    return out
