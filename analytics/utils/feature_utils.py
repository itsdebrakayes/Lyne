"""
Feature engineering utilities for analytics notebooks.
"""
import pandas as pd
from typing import List, Dict, Any


DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']


def get_day_name(dow: int) -> str:
    """Get day name from day of week number (0=Sunday)."""
    return DAY_NAMES[dow] if 0 <= dow <= 6 else ''


def add_time_features(df: pd.DataFrame, timestamp_col: str = 'timestamp') -> pd.DataFrame:
    """
    Add time-based features to DataFrame.
    
    Adds: dow, hour, is_weekend, week, month, year
    """
    df = df.copy()
    
    # Ensure datetime
    df[timestamp_col] = pd.to_datetime(df[timestamp_col])
    
    # Extract features
    df['dow'] = df[timestamp_col].dt.dayofweek  # 0=Monday in pandas
    df['dow_adjusted'] = (df['dow'] + 1) % 7    # Convert to 0=Sunday
    df['hour'] = df[timestamp_col].dt.hour
    df['is_weekend'] = df['dow'].isin([5, 6]).astype(int)  # Sat=5, Sun=6
    df['week'] = df[timestamp_col].dt.isocalendar().week
    df['month'] = df[timestamp_col].dt.month
    df['year'] = df[timestamp_col].dt.year
    df['date'] = df[timestamp_col].dt.date
    
    return df


def bin_hours(df: pd.DataFrame, hour_col: str = 'hour', bins: List[int] = None) -> pd.DataFrame:
    """Add hour bins for grouping."""
    df = df.copy()
    
    if bins is None:
        bins = [0, 6, 9, 12, 15, 18, 21, 24]
        labels = ['night', 'early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night_late']
    else:
        labels = [f'bin_{i}' for i in range(len(bins) - 1)]
    
    df['hour_bin'] = pd.cut(df[hour_col], bins=bins, labels=labels[:-1], right=False)
    
    return df


def calculate_traffic_by_slot(df: pd.DataFrame, dow_col: str = 'dow', hour_col: str = 'hour') -> pd.DataFrame:
    """
    Calculate average traffic by day-of-week and hour slot.
    
    Returns DataFrame with dow, hour, avg_traffic columns.
    """
    # Group by dow + hour and count
    traffic = df.groupby([dow_col, hour_col]).size().reset_index(name='count')
    
    # Get number of unique dates for each dow to calculate average
    dates_per_dow = df.groupby(dow_col)['date'].nunique().reset_index(name='num_days')
    
    traffic = traffic.merge(dates_per_dow, on=dow_col)
    traffic['avg_traffic'] = traffic['count'] / traffic['num_days']
    
    return traffic[[dow_col, hour_col, 'avg_traffic']]


def identify_peak_slots(traffic_df: pd.DataFrame, top_n: int = 5) -> List[Dict[str, Any]]:
    """Identify top N peak traffic slots."""
    sorted_df = traffic_df.sort_values('avg_traffic', ascending=False).head(top_n)
    
    results = []
    for rank, (_, row) in enumerate(sorted_df.iterrows(), 1):
        results.append({
            'dow': int(row['dow']),
            'dow_name': get_day_name(int(row['dow'])),
            'hour': int(row['hour']),
            'avg_traffic': round(row['avg_traffic'], 1),
            'rank': rank
        })
    
    return results


def calculate_dropoff_rate(events_df: pd.DataFrame, status_col: str = 'event_type') -> Dict[str, float]:
    """
    Calculate drop-off rates from queue events.
    
    Drop-off = cancelled + no_show + abandoned
    """
    total = len(events_df[events_df[status_col] == 'created'])
    if total == 0:
        return {'dropoff_rate': 0.0, 'dropoff_count': 0}
    
    dropoffs = len(events_df[events_df[status_col].isin(['cancelled', 'no_show', 'abandoned'])])
    
    return {
        'dropoff_rate': round(dropoffs / total, 3),
        'dropoff_count': dropoffs
    }


def identify_best_times(traffic_df: pd.DataFrame, dropoff_df: pd.DataFrame = None, top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Identify best times to visit based on low traffic and low dropoff.
    
    Score = (1 - normalized_traffic) * 0.7 + (1 - normalized_dropoff) * 0.3
    """
    df = traffic_df.copy()
    
    # Normalize traffic
    max_traffic = df['avg_traffic'].max()
    df['traffic_score'] = 1 - (df['avg_traffic'] / max_traffic) if max_traffic > 0 else 1
    
    # If dropoff data provided, incorporate it
    if dropoff_df is not None and len(dropoff_df) > 0:
        df = df.merge(dropoff_df, on='hour', how='left')
        df['dropoff_rate'] = df['dropoff_rate'].fillna(0)
        max_dropoff = df['dropoff_rate'].max()
        df['dropoff_score'] = 1 - (df['dropoff_rate'] / max_dropoff) if max_dropoff > 0 else 1
        df['score'] = df['traffic_score'] * 0.7 + df['dropoff_score'] * 0.3
    else:
        df['score'] = df['traffic_score']
    
    df['score'] = (df['score'] * 100).round(0)
    
    # Get top slots
    sorted_df = df.sort_values('score', ascending=False).head(top_n)
    
    results = []
    for _, row in sorted_df.iterrows():
        reason_parts = []
        if row['avg_traffic'] < traffic_df['avg_traffic'].median():
            reason_parts.append('low traffic')
        if 'dropoff_rate' in row and row['dropoff_rate'] < 0.1:
            reason_parts.append('low drop-off')
        
        results.append({
            'dow': int(row['dow']),
            'dow_name': get_day_name(int(row['dow'])),
            'hour': int(row['hour']),
            'score': int(row['score']),
            'reason': ' + '.join(reason_parts) if reason_parts else 'optimal conditions'
        })
    
    return results
