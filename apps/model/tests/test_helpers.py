"""Unit tests for the pure ML helpers — no DB, CI-safe. Run: python -m unittest discover -s tests"""
import os
import sys
import math
import unittest
import datetime as dt

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.model_utils import SafeLabelEncoder, temporal_split, hour_of
from utils.calendar_features import is_month_end, add_calendar_features, load_holidays
from scripts.recommend_staffing import erlang_c_wait_minutes, recommend_servers


class SafeEncoderTests(unittest.TestCase):
    def test_unseen_maps_to_minus_one(self):
        enc = SafeLabelEncoder().fit(["a", "b", "c"])
        out = list(enc.transform(["a", "c", "zzz", None]))
        self.assertEqual(out[2], -1)   # unseen
        self.assertEqual(out[3], -1)   # None
        self.assertNotEqual(out[0], -1)

    def test_stable_ordering(self):
        enc = SafeLabelEncoder().fit(["b", "a", "c"])
        self.assertEqual(enc.transform(["a"])[0], 0)   # sorted → a=0


class TemporalSplitTests(unittest.TestCase):
    def test_holds_out_most_recent(self):
        df = pd.DataFrame({
            "visit_date": pd.to_datetime([f"2026-01-{d:02d}" for d in range(1, 11)]),
            "v": range(10),
        })
        train, test = temporal_split(df, "visit_date", test_frac=0.2)
        self.assertEqual(len(train), 8)
        self.assertEqual(len(test), 2)
        self.assertTrue(train["visit_date"].max() <= test["visit_date"].min())


class ErlangCTests(unittest.TestCase):
    def test_unstable_when_load_exceeds_servers(self):
        # arrivals 20/hr, service 4/hr/counter → 1 counter can't cope
        self.assertEqual(erlang_c_wait_minutes(20, 4, 1), math.inf)

    def test_wait_decreases_as_counters_increase(self):
        waits = [erlang_c_wait_minutes(15, 4, c) for c in range(4, 9)]
        finite = [w for w in waits if math.isfinite(w)]
        self.assertEqual(finite, sorted(finite, reverse=True))  # monotonic ↓

    def test_recommend_min_counters_meeting_target(self):
        c, wq = recommend_servers(15, 4, target_wait=20, max_c=12)
        self.assertGreater(c, 0)
        self.assertLessEqual(wq, 20)
        # one fewer counter should miss the target
        self.assertGreater(erlang_c_wait_minutes(15, 4, c - 1), 20)


class CalendarTests(unittest.TestCase):
    def test_month_end(self):
        self.assertTrue(is_month_end(dt.date(2026, 1, 30)))
        self.assertFalse(is_month_end(dt.date(2026, 1, 15)))

    def test_holiday_feature_from_calendar(self):
        holidays = load_holidays(None)  # bundled Jamaica set
        df = pd.DataFrame({"visit_date": pd.to_datetime(["2026-05-23", "2026-05-20"])})
        out = add_calendar_features(df, "visit_date", holidays)
        self.assertEqual(out.loc[0, "is_holiday"], 1)   # Labour Day
        self.assertEqual(out.loc[1, "is_holiday"], 0)

    def test_hour_of_handles_timedelta_and_string(self):
        self.assertEqual(hour_of(dt.timedelta(hours=8), 0), 8)
        self.assertEqual(hour_of("16:00:00", 0), 16)
        self.assertEqual(hour_of(None, 9), 9)


if __name__ == "__main__":
    unittest.main()
