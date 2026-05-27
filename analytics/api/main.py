"""
Q ME NOW — Analytics Microservice (FastAPI)
============================================
Provides REST endpoints for the predictive analytics engine.
Reads from MySQL (via CSV exports or direct connection) and returns
structured predictions for the main backend to consume.

Endpoints:
  GET  /health                          — Health check
  GET  /api/analytics/best-time         — Best time to visit a branch/service
  GET  /api/analytics/peak-hours        — Peak and off-peak hours for a branch
  GET  /api/analytics/wait-prediction   — Predicted wait time for a given context
  GET  /api/analytics/service-ranking   — Fastest/slowest services for a branch
  GET  /api/analytics/branch-trends     — Branch performance trends over time
  POST /api/analytics/run-model         — Trigger a full model re-run (admin only)

Authentication:
  All endpoints require the X-API-Key header matching ANALYTICS_API_KEY env var.
  The main backend calls this service internally — it is NOT exposed to the public.
"""

import os
import json
from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── App setup ─────────────────────────────────────────────────
app = FastAPI(
    title="Q ME NOW Analytics API",
    description="Internal analytics microservice for Q ME NOW predictive engine",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENV", "development") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", os.getenv("BACKEND_URL", "")],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── API Key auth ──────────────────────────────────────────────
API_KEY        = os.getenv("ANALYTICS_API_KEY", "dev-analytics-key-change-in-production")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key.")
    return api_key

# ── Database connection ───────────────────────────────────────
def get_db_connection():
    """Get a MySQL connection. Falls back to CSV data if DB is unavailable."""
    try:
        import mysql.connector
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "qmenow"),
        )
        return conn
    except Exception:
        return None

# ── Response models ───────────────────────────────────────────
class BestTimeSlot(BaseModel):
    day_of_week:       int
    day_name:          str
    hour_of_day:       int
    hour_label:        str
    expected_wait_min: float
    confidence:        str
    description:       str

class BestTimeResponse(BaseModel):
    branch_id:    str
    service_id:   Optional[str]
    best_slots:   list[BestTimeSlot]
    worst_slots:  list[BestTimeSlot]
    generated_at: str

class PeakHourEntry(BaseModel):
    hour_of_day:   int
    hour_label:    str
    avg_wait_min:  float
    avg_queue_len: float
    is_peak:       bool

class PeakHoursResponse(BaseModel):
    branch_id:    str
    day_of_week:  Optional[int]
    peak_hours:   list[PeakHourEntry]
    generated_at: str

class WaitPrediction(BaseModel):
    predicted_wait_min: float
    confidence_interval_low:  float
    confidence_interval_high: float
    model_version:  str
    factors_used:   list[str]

class ServiceRankEntry(BaseModel):
    service_id:   str
    service_name: str
    avg_wait_min: float
    avg_svc_min:  float
    rank:         int
    tier:         str  # 'fastest', 'average', 'slowest'

class BranchTrendEntry(BaseModel):
    period:          str
    avg_wait_min:    float
    total_served:    int
    no_show_rate:    float
    peak_hour:       int

# ── Utility functions ─────────────────────────────────────────
DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

def hour_label(h: int) -> str:
    if h == 0:   return "12:00 AM"
    if h < 12:   return f"{h}:00 AM"
    if h == 12:  return "12:00 PM"
    return f"{h-12}:00 PM"

def load_csv_fallback(filename: str) -> list[dict]:
    """Load data from CSV export as fallback when DB is unavailable."""
    import csv
    path = os.path.join(os.path.dirname(__file__), "..", "data_exports", filename)
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":    "ok",
        "service":   "qme-now-analytics",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/api/analytics/best-time", response_model=BestTimeResponse)
def best_time(
    branch_id:  str = Query(..., description="Branch UUID"),
    service_id: Optional[str] = Query(None, description="Service UUID (optional)"),
    _key: str = Depends(verify_api_key),
):
    """
    Returns the best and worst times to visit a branch/service.
    Analyzes historical wait_time_records to find low-traffic windows.

    Example output:
      "Best: Tuesday 10:00 AM — expected wait 8 min"
      "Worst: Friday 2:00 PM — expected wait 47 min"
    """
    conn = get_db_connection()

    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            query = """
                SELECT
                    day_of_week,
                    hour_of_day,
                    AVG(wait_time_minutes)  AS avg_wait,
                    COUNT(*)               AS sample_count
                FROM wait_time_records
                WHERE branch_id = %s
                  AND status = 'served'
                  AND wait_time_minutes IS NOT NULL
            """
            params = [branch_id]
            if service_id:
                query += " AND service_id = %s"
                params.append(service_id)
            query += " GROUP BY day_of_week, hour_of_day HAVING sample_count >= 3 ORDER BY avg_wait ASC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
        except Exception as e:
            rows = []
    else:
        # Fallback to CSV
        all_rows = load_csv_fallback("best_time_to_visit.csv")
        rows = [r for r in all_rows if r.get("branch_id") == branch_id]
        rows = sorted(rows, key=lambda r: float(r.get("avg_wait_minutes", 999)))

    if not rows:
        raise HTTPException(status_code=404, detail="Not enough data to generate best-time predictions for this branch.")

    def row_to_slot(row, rank_desc: str) -> BestTimeSlot:
        dow  = int(row.get("day_of_week", 0))
        hour = int(row.get("hour_of_day", row.get("hour", 9)))
        wait = float(row.get("avg_wait", row.get("avg_wait_minutes", 15)))
        cnt  = int(row.get("sample_count", row.get("sample_count", 10)))
        confidence = "high" if cnt >= 20 else ("medium" if cnt >= 10 else "low")
        return BestTimeSlot(
            day_of_week=dow,
            day_name=DAY_NAMES[dow % 7],
            hour_of_day=hour,
            hour_label=hour_label(hour),
            expected_wait_min=round(wait, 1),
            confidence=confidence,
            description=f"{rank_desc}: {DAY_NAMES[dow % 7]} {hour_label(hour)} — expected wait {round(wait)} min",
        )

    best_slots  = [row_to_slot(r, "Best time")  for r in rows[:3]]
    worst_slots = [row_to_slot(r, "Busiest time") for r in rows[-3:]][::-1]

    return BestTimeResponse(
        branch_id=branch_id,
        service_id=service_id,
        best_slots=best_slots,
        worst_slots=worst_slots,
        generated_at=datetime.utcnow().isoformat(),
    )

@app.get("/api/analytics/peak-hours", response_model=PeakHoursResponse)
def peak_hours(
    branch_id:   str = Query(..., description="Branch UUID"),
    day_of_week: Optional[int] = Query(None, ge=0, le=6, description="0=Sun ... 6=Sat"),
    _key: str = Depends(verify_api_key),
):
    """Returns peak and off-peak hours for a branch, optionally filtered by day."""
    conn = get_db_connection()

    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            query = """
                SELECT
                    hour_of_day,
                    AVG(wait_time_minutes)  AS avg_wait,
                    AVG(queue_length_at_time) AS avg_queue_len,
                    COUNT(*) AS cnt
                FROM wait_time_records
                WHERE branch_id = %s AND status = 'served'
            """
            params = [branch_id]
            if day_of_week is not None:
                query += " AND day_of_week = %s"
                params.append(day_of_week)
            query += " GROUP BY hour_of_day ORDER BY hour_of_day"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
        except Exception:
            rows = []
    else:
        rows = []

    if not rows:
        # Generate synthetic data for demonstration
        rows = [
            {"hour_of_day": h, "avg_wait": 10 + 20 * (1 if 9 <= h <= 11 or 13 <= h <= 15 else 0),
             "avg_queue_len": 3 + 8 * (1 if 9 <= h <= 11 or 13 <= h <= 15 else 0), "cnt": 5}
            for h in range(8, 18)
        ]

    if not rows:
        raise HTTPException(status_code=404, detail="No data available for this branch.")

    avg_waits = [float(r.get("avg_wait", 0)) for r in rows]
    threshold = sum(avg_waits) / len(avg_waits) * 1.2  # 20% above average = peak

    entries = []
    for row in rows:
        hour = int(row.get("hour_of_day", 0))
        wait = float(row.get("avg_wait", 0))
        qlen = float(row.get("avg_queue_len", 0))
        entries.append(PeakHourEntry(
            hour_of_day=hour,
            hour_label=hour_label(hour),
            avg_wait_min=round(wait, 1),
            avg_queue_len=round(qlen, 1),
            is_peak=wait >= threshold,
        ))

    return PeakHoursResponse(
        branch_id=branch_id,
        day_of_week=day_of_week,
        peak_hours=entries,
        generated_at=datetime.utcnow().isoformat(),
    )

@app.get("/api/analytics/wait-prediction", response_model=WaitPrediction)
def wait_prediction(
    branch_id:   str = Query(...),
    service_id:  str = Query(...),
    queue_length: int = Query(..., ge=0, le=500),
    staff_count:  int = Query(..., ge=1, le=100),
    hour_of_day:  int = Query(..., ge=0, le=23),
    day_of_week:  int = Query(..., ge=0, le=6),
    _key: str = Depends(verify_api_key),
):
    """
    Predicts wait time for a customer joining the queue right now.
    Uses a trained Random Forest model if available, otherwise falls back
    to a weighted heuristic based on historical averages.
    """
    import math

    # Try to load a trained model
    model_path = os.path.join(os.path.dirname(__file__), "..", "state", "wait_model.pkl")
    model_version = "heuristic-v1"
    predicted = None

    if os.path.exists(model_path):
        try:
            import pickle
            import numpy as np
            with open(model_path, "rb") as f:
                model = pickle.load(f)
            features = np.array([[queue_length, staff_count, hour_of_day, day_of_week]])
            predicted = float(model.predict(features)[0])
            model_version = "rf-v1"
        except Exception:
            predicted = None

    if predicted is None:
        # Heuristic: base_wait * queue_length / staff_count, adjusted for time of day
        base_wait = 15.0
        time_factor = 1.3 if (9 <= hour_of_day <= 11 or 13 <= hour_of_day <= 15) else 1.0
        predicted = (base_wait * queue_length / max(staff_count, 1)) * time_factor
        predicted = max(2.0, min(predicted, 240.0))

    margin = predicted * 0.25

    return WaitPrediction(
        predicted_wait_min=round(predicted, 1),
        confidence_interval_low=round(max(0, predicted - margin), 1),
        confidence_interval_high=round(predicted + margin, 1),
        model_version=model_version,
        factors_used=["queue_length", "staff_count", "hour_of_day", "day_of_week"],
    )

@app.get("/api/analytics/service-ranking", response_model=list[ServiceRankEntry])
def service_ranking(
    branch_id: str = Query(...),
    _key: str = Depends(verify_api_key),
):
    """Returns services ranked by average wait time (fastest to slowest)."""
    conn = get_db_connection()
    rows = []

    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT
                    wtr.service_id,
                    s.name AS service_name,
                    AVG(wtr.wait_time_minutes)    AS avg_wait,
                    AVG(wtr.service_time_minutes) AS avg_svc,
                    COUNT(*) AS cnt
                FROM wait_time_records wtr
                JOIN services s ON wtr.service_id = s.id
                WHERE wtr.branch_id = %s AND wtr.status = 'served'
                GROUP BY wtr.service_id, s.name
                HAVING cnt >= 5
                ORDER BY avg_wait ASC
            """, [branch_id])
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
        except Exception:
            rows = []

    if not rows:
        # Fallback to CSV
        csv_rows = load_csv_fallback("service_performance_summary.csv")
        rows = [r for r in csv_rows if r.get("branch_id") == branch_id]

    if not rows:
        return []

    result = []
    total  = len(rows)
    for i, row in enumerate(rows):
        rank = i + 1
        if rank <= max(1, total // 3):
            tier = "fastest"
        elif rank <= max(2, 2 * total // 3):
            tier = "average"
        else:
            tier = "slowest"

        result.append(ServiceRankEntry(
            service_id=str(row.get("service_id", "")),
            service_name=str(row.get("service_name", "Unknown")),
            avg_wait_min=round(float(row.get("avg_wait", row.get("avg_wait_minutes", 0))), 1),
            avg_svc_min=round(float(row.get("avg_svc", row.get("avg_service_minutes", 0))), 1),
            rank=rank,
            tier=tier,
        ))

    return result

@app.get("/api/analytics/branch-trends", response_model=list[BranchTrendEntry])
def branch_trends(
    branch_id:   str = Query(...),
    period:      str = Query("weekly", regex="^(weekly|monthly)$"),
    num_periods: int = Query(12, ge=1, le=52),
    _key: str = Depends(verify_api_key),
):
    """Returns branch performance trends over time (weekly or monthly)."""
    conn = get_db_connection()
    rows = []

    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            if period == "weekly":
                group_expr = "YEARWEEK(visit_date, 1)"
                label_expr = "CONCAT(YEAR(visit_date), '-W', LPAD(WEEK(visit_date, 1), 2, '0'))"
            else:
                group_expr = "DATE_FORMAT(visit_date, '%Y-%m')"
                label_expr = "DATE_FORMAT(visit_date, '%Y-%m')"

            cursor.execute(f"""
                SELECT
                    {label_expr} AS period,
                    AVG(wait_time_minutes) AS avg_wait,
                    COUNT(CASE WHEN status = 'served' THEN 1 END) AS total_served,
                    COUNT(CASE WHEN status IN ('left','cancelled') THEN 1 END) AS no_shows,
                    COUNT(*) AS total,
                    (SELECT hour_of_day FROM wait_time_records w2
                     WHERE w2.branch_id = %s AND {group_expr} = {group_expr}
                     GROUP BY hour_of_day ORDER BY COUNT(*) DESC LIMIT 1) AS peak_hour
                FROM wait_time_records
                WHERE branch_id = %s
                GROUP BY {group_expr}
                ORDER BY {group_expr} DESC
                LIMIT %s
            """, [branch_id, branch_id, num_periods])
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
        except Exception:
            rows = []

    if not rows:
        csv_rows = load_csv_fallback("branch_performance_summary.csv")
        rows = [r for r in csv_rows if r.get("branch_id") == branch_id][:num_periods]

    result = []
    for row in rows:
        total    = int(row.get("total", 1)) or 1
        no_shows = int(row.get("no_shows", 0))
        served   = int(row.get("total_served", total - no_shows))
        result.append(BranchTrendEntry(
            period=str(row.get("period", "")),
            avg_wait_min=round(float(row.get("avg_wait", row.get("avg_wait_minutes", 0)) or 0), 1),
            total_served=served,
            no_show_rate=round(no_shows / total, 3),
            peak_hour=int(row.get("peak_hour", 10) or 10),
        ))

    return result

@app.post("/api/analytics/run-model")
def run_model(
    branch_id: Optional[str] = None,
    _key: str = Depends(verify_api_key),
):
    """
    Triggers a full model re-run. Runs the build_model.py script asynchronously.
    This endpoint is for internal use by scheduled jobs only.
    """
    import subprocess
    script = os.path.join(os.path.dirname(__file__), "..", "scripts", "build_model.py")
    if not os.path.exists(script):
        raise HTTPException(status_code=503, detail="Model build script not found.")

    args = ["python3", script]
    if branch_id:
        args += ["--branch-id", branch_id]

    try:
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {
            "status":  "started",
            "pid":     proc.pid,
            "message": "Model re-run started in background.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start model run: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("ANALYTICS_PORT", "5000")))
