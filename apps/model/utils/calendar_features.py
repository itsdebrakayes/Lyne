"""
calendar_features.py — Shared calendar/holiday feature engineering.

Government-agency demand is driven as much by the calendar as by the hour:
public holidays (and the days bracketing them) and month-end tax/payment
deadlines cause predictable surges. Every model that touches dates should
build these features the same way, so the logic lives here once.

Two consumers:
  • The wait-time / no-show models, which annotate *historical* rows.
  • The demand forecast, which must annotate *future* dates that have no
    operational data yet — so holidays cannot come from the visit data,
    they must come from the calendar.

Holidays load from the `public_holidays` table when a DB connection is
given; otherwise a bundled Jamaica set (2025–2027) is used so notebooks
still work offline. Keep the bundled set in sync with migration 013.
"""
from __future__ import annotations

import datetime as _dt
from typing import Iterable, Set

import pandas as pd

# Bundled fallback — mirrors database/migrations/013_public_holidays.sql
_JM_HOLIDAYS_FALLBACK: Set[str] = {
    "2025-01-01", "2025-03-05", "2025-04-18", "2025-04-21", "2025-05-23",
    "2025-08-01", "2025-08-06", "2025-10-20", "2025-12-25", "2025-12-26",
    "2026-01-01", "2026-02-18", "2026-04-03", "2026-04-06", "2026-05-23",
    "2026-08-01", "2026-08-06", "2026-10-19", "2026-12-25", "2026-12-26",
    "2027-01-01", "2027-02-10", "2027-03-26", "2027-03-29", "2027-05-23",
    "2027-08-01", "2027-08-06", "2027-10-18", "2027-12-25", "2027-12-26",
}


def load_holidays(conn=None, country: str = "JM") -> Set[_dt.date]:
    """Return the set of holiday dates. Prefers the DB, falls back to bundled."""
    if conn is not None:
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT holiday_date FROM public_holidays WHERE country = %s",
                    (country,),
                )
                rows = cursor.fetchall()
            dates = set()
            for row in rows:
                value = row["holiday_date"] if isinstance(row, dict) else row[0]
                if isinstance(value, _dt.datetime):
                    value = value.date()
                dates.add(value)
            if dates:
                return dates
        except Exception:
            pass  # fall through to bundled set
    return {_dt.date.fromisoformat(d) for d in _JM_HOLIDAYS_FALLBACK}


def is_month_end(day: _dt.date) -> bool:
    """True on the last 3 calendar days of the month (deadline crunch)."""
    last_day = (day.replace(day=28) + _dt.timedelta(days=4)).replace(day=1) - _dt.timedelta(days=1)
    return day.day >= last_day.day - 2


def add_calendar_features(
    df: pd.DataFrame,
    date_col: str = "visit_date",
    holidays: Iterable[_dt.date] | None = None,
) -> pd.DataFrame:
    """Add calendar features derived purely from the date.

    Adds: is_holiday, is_pre_holiday, is_post_holiday, is_month_end,
    is_month_start, is_weekend, day_of_month. Works for past or future dates.
    """
    out = df.copy()
    dates = pd.to_datetime(out[date_col])
    holiday_set = set(pd.Timestamp(h).normalize() for h in (holidays or _default_holiday_dates()))

    norm = dates.dt.normalize()
    out["is_holiday"] = norm.isin(holiday_set).astype(int)
    out["is_pre_holiday"] = (norm + pd.Timedelta(days=1)).isin(holiday_set).astype(int)
    out["is_post_holiday"] = (norm - pd.Timedelta(days=1)).isin(holiday_set).astype(int)
    out["day_of_month"] = dates.dt.day
    out["is_month_end"] = dates.dt.day.map(lambda d: 1 if d >= 26 else 0).astype(int)
    out["is_month_start"] = (dates.dt.day <= 3).astype(int)
    out["is_weekend"] = dates.dt.dayofweek.isin([5, 6]).astype(int)
    return out


def _default_holiday_dates() -> Set[_dt.date]:
    return {_dt.date.fromisoformat(d) for d in _JM_HOLIDAYS_FALLBACK}
