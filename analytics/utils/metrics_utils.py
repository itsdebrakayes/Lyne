"""
Metrics and scoring utilities for analytics notebooks.
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple


def calculate_z_scores(series: pd.Series) -> pd.Series:
    """Calculate z-scores for a series."""
    mean = series.mean()
    std = series.std()
    if std == 0:
        return pd.Series([0] * len(series), index=series.index)
    return (series - mean) / std


def detect_anomalies(df: pd.DataFrame, value_col: str, date_col: str = 'date', threshold: float = 2.0) -> List[Dict[str, Any]]:
    """
    Detect anomalies based on z-score threshold.
    
    Returns list of anomaly records with date, value, expected, z_score, severity.
    """
    df = df.copy()
    df['z_score'] = calculate_z_scores(df[value_col])
    
    # Filter anomalies
    anomalies = df[abs(df['z_score']) >= threshold]
    
    mean_val = df[value_col].mean()
    
    results = []
    for _, row in anomalies.iterrows():
        z = row['z_score']
        severity = 'critical' if abs(z) >= 3 else 'warning' if abs(z) >= 2.5 else 'info'
        
        results.append({
            'date': str(row[date_col]),
            'metric': value_col,
            'value': round(row[value_col], 1),
            'expected': round(mean_val, 1),
            'z_score': round(z, 2),
            'severity': severity
        })
    
    return results


def calculate_efficiency_score(
    customers_served: float,
    avg_service_time: float,
    avg_wait_time: float,
    dropoff_rate: float = 0.0,
    weights: Dict[str, float] = None
) -> float:
    """
    Calculate staff efficiency score (0-100).
    
    Default weights:
    - 40% customers served (higher is better)
    - 25% service time (lower is better)
    - 25% wait time (lower is better)
    - 10% dropoff rate (lower is better)
    """
    if weights is None:
        weights = {
            'served': 0.40,
            'service_time': 0.25,
            'wait_time': 0.25,
            'dropoff': 0.10
        }
    
    # Normalize each metric (we'll need context for proper normalization)
    # For now, use simple scaling
    served_score = min(customers_served / 20, 1.0)  # Assume 20/day is max
    service_score = max(0, 1 - (avg_service_time / 30))  # 30 min is bad
    wait_score = max(0, 1 - (avg_wait_time / 60))  # 60 min is bad
    dropoff_score = max(0, 1 - dropoff_rate)
    
    score = (
        served_score * weights['served'] +
        service_score * weights['service_time'] +
        wait_score * weights['wait_time'] +
        dropoff_score * weights['dropoff']
    )
    
    return round(score * 100, 1)


def calculate_utilization(busy_time_minutes: float, available_time_minutes: float) -> float:
    """Calculate utilization ratio."""
    if available_time_minutes <= 0:
        return 0.0
    return round(busy_time_minutes / available_time_minutes, 3)


def get_utilization_status(utilization: float) -> str:
    """Categorize utilization level."""
    if utilization < 0.4:
        return 'over_resourced'
    elif utilization > 0.85:
        return 'under_resourced'
    else:
        return 'optimal'


def rank_staff(staff_df: pd.DataFrame, score_col: str = 'efficiency_score') -> pd.DataFrame:
    """Add ranking to staff DataFrame."""
    df = staff_df.copy()
    df['rank'] = df[score_col].rank(ascending=False, method='min').astype(int)
    return df.sort_values('rank')


def calculate_trend(
    df: pd.DataFrame,
    value_col: str,
    date_col: str = 'date',
    compare_periods: int = 2
) -> Tuple[str, float]:
    """
    Calculate trend direction and percentage change.
    
    Returns: (trend: 'up'|'down'|'stable', change_percent: float)
    """
    df = df.sort_values(date_col)
    
    if len(df) < compare_periods:
        return 'stable', 0.0
    
    # Split into periods
    mid = len(df) // 2
    prev_avg = df.iloc[:mid][value_col].mean()
    curr_avg = df.iloc[mid:][value_col].mean()
    
    if prev_avg == 0:
        return 'stable', 0.0
    
    change = ((curr_avg - prev_avg) / prev_avg) * 100
    
    if abs(change) < 5:
        trend = 'stable'
    elif change > 0:
        trend = 'up'
    else:
        trend = 'down'
    
    return trend, round(change, 1)


def generate_weekly_trend(
    df: pd.DataFrame,
    value_col: str,
    date_col: str = 'date',
    staff_col: str = None
) -> List[Dict[str, Any]]:
    """Generate weekly aggregated trend data."""
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df['week'] = df[date_col].dt.strftime('%Y-W%V')
    
    if staff_col:
        agg = df.groupby(['week', staff_col])[value_col].mean().reset_index()
    else:
        agg = df.groupby('week')[value_col].mean().reset_index()
    
    return agg.to_dict('records')


def calculate_completion_rate(completed: int, total: int) -> float:
    """Calculate completion rate."""
    if total <= 0:
        return 0.0
    return round(completed / total, 3)
