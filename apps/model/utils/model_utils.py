"""
model_utils.py — Shared modelling helpers used across the Lyne models.

Two things every model here needs and kept getting wrong on its own:

  • Temporal validation. Queue data is a time series. A random train/test
    split lets the model peek at the future to "predict" the past, which
    inflates R²/MAE — the very numbers executives use to decide whether to
    trust the forecast. `temporal_split` holds out the most recent slice.

  • Robust categorical encoding. sklearn's LabelEncoder raises on any value
    it did not see at fit time, so a brand-new branch or service crashes
    scoring in production. `SafeLabelEncoder` maps unseen categories to -1.
"""
from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd


class SafeLabelEncoder:
    """LabelEncoder that maps unseen categories to -1 instead of raising."""

    def __init__(self):
        self._map: dict = {}

    def fit(self, values) -> "SafeLabelEncoder":
        classes = pd.Series(values).dropna().unique()
        self._map = {value: idx for idx, value in enumerate(sorted(classes, key=str))}
        return self

    def transform(self, values) -> np.ndarray:
        return np.array([self._map.get(v, -1) for v in values], dtype=int)

    def fit_transform(self, values) -> np.ndarray:
        return self.fit(values).transform(values)

    @property
    def classes_(self):
        return list(self._map.keys())


def hour_of(value, default=0):
    """Hour-of-day from a MySQL TIME column, however the driver returns it.

    pymysql hands back a datetime.timedelta ('8:00:00'), pandas may surface a
    Timedelta ('0 days 08:00:00'), and a plain string is possible too — so
    naive string slicing (value[:2]) breaks on single-digit hours. Normalise
    all of them here.
    """
    if value is None:
        return default
    total = getattr(value, "total_seconds", None)
    if callable(total):
        return int(total() // 3600)
    if hasattr(value, "hour"):          # datetime.time
        return int(value.hour)
    text = str(value)
    if ":" in text:
        head = text.split(":")[0].strip().split()[-1]   # handles '0 days 08'
        if head.lstrip("-").isdigit():
            return int(head)
    return default


def temporal_split(
    df: pd.DataFrame,
    date_col: str = "visit_date",
    test_frac: float = 0.2,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Split chronologically: earliest (1-test_frac) trains, latest test_frac tests.

    Falls back to a proportional split on the existing order when the date
    column is missing, so callers never crash on sparse frames.
    """
    if date_col in df.columns:
        ordered = df.sort_values(date_col).reset_index(drop=True)
    else:
        ordered = df.reset_index(drop=True)
    cut = int(len(ordered) * (1 - test_frac))
    cut = max(1, min(cut, len(ordered) - 1)) if len(ordered) > 1 else len(ordered)
    return ordered.iloc[:cut].copy(), ordered.iloc[cut:].copy()
