"""live_worker.py — the containerized analytics worker.

Makes the models genuinely LIVE. Runs the six model scripts against the DB on
boot and on a schedule, so predictive_results is produced by the models rather
than seeded. Also services the admin dashboard's manual "Update now" trigger
(the pipeline_runs queue).

Demo-friendly: on a fresh volume where wait_time_records is thin, it first
generates the realistic stressed/moderate history (generate_sample_data.py) so
the models have honest signal to learn from — the reproducible source of the
demo history, replacing seed.sql's near-uniform procedural fallback.

Only the model scripts run here — no Jupyter/papermill/CSV path. The retired
legacy insights (branch/service/manager performance, heatmap) are computed live
by the dashboards from wait_time_records, not from imported CSVs.
"""

import os
import sys
import subprocess
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from utils.dbio import connect  # noqa: E402

MODEL_SCRIPTS = [
    "wait_time_model.py",              # wait_eta_grid, service_time, best_time, model_perf
    "forecast_demand.py",             # demand_forecast (GBR + lags)
    "recommend_staffing.py",          # staffing_recommendation (Erlang-C)
    "predict_no_show.py",             # no_show_risk
    "forecast_targets.py",            # target_attainment
    "detect_operational_anomalies.py",  # operational_anomalies
    "score_manager_performance.py",   # manager_performance
]

REFRESH_SECONDS = int(os.getenv("MODEL_REFRESH_SECONDS", str(2 * 60 * 60)))  # every 2h
HISTORY_DAYS = int(os.getenv("MODEL_HISTORY_DAYS", "150"))
MIN_HISTORY_ROWS = int(os.getenv("MODEL_MIN_HISTORY_ROWS", "1000"))


def _run(script, args=None):
    result = subprocess.run(
        [sys.executable, str(BASE / "scripts" / script)] + (args or []),
        cwd=str(BASE),
    )
    return result.returncode == 0


def _scalar(sql):
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
            return list(row.values())[0] if row else 0
    finally:
        conn.close()


def wait_for_db(attempts=90):
    for i in range(attempts):
        try:
            connect().close()
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"[worker] waiting for DB ({i + 1}/{attempts}): {exc}", flush=True)
            time.sleep(2)
    return False


def ensure_history():
    """On a fresh volume, generate the realistic demo history first.

    Regenerate when history is thin OR only covers a couple of branches:
    seed.sql bootstraps ~1500 rows for just 2 branches, which clears the raw
    row-count threshold but is NOT the full realistic dataset. Comparing branch
    coverage against the live branch table catches that case."""
    rows = _scalar("SELECT COUNT(*) AS n FROM wait_time_records")
    covered = _scalar("SELECT COUNT(DISTINCT branch_id) AS n FROM wait_time_records")
    active = _scalar("SELECT COUNT(*) AS n FROM branches WHERE is_active = TRUE")
    if rows < MIN_HISTORY_ROWS or covered < active:
        print(f"[worker] history thin/partial ({rows} rows, {covered}/{active} branches) "
              f"— generating {HISTORY_DAYS}d of realistic data", flush=True)
        _run("generate_sample_data.py", ["--days", str(HISTORY_DAYS)])
    else:
        print(f"[worker] history present ({rows} rows across {covered} branches) — leaving as-is", flush=True)


def run_models(label):
    ok = True
    for script in MODEL_SCRIPTS:
        if not _run(script, ["--write-db"]):
            print(f"[worker] {script} FAILED", flush=True)
            ok = False
    print(f"[worker] model run complete ({label}); ok={ok}", flush=True)
    return ok


def process_manual_triggers():
    """Service any queued 'Update now' requests from the admin dashboard."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM pipeline_runs WHERE status = 'queued' ORDER BY created_at LIMIT 5")
            queued = cur.fetchall()
            for run in queued:
                cur.execute("UPDATE pipeline_runs SET status='running', started_at=NOW() WHERE id=%s", [run["id"]])
                conn.commit()
                ok = run_models("manual")
                cur.execute(
                    "UPDATE pipeline_runs SET status=%s, completed_at=NOW(), error_message=%s WHERE id=%s",
                    ["succeeded" if ok else "failed", None if ok else "One or more model steps failed.", run["id"]],
                )
                conn.commit()
    except Exception as exc:  # noqa: BLE001
        print(f"[worker] manual-trigger poll error: {exc}", flush=True)
    finally:
        conn.close()


def main():
    print("[worker] Lyne live model worker starting", flush=True)
    if not wait_for_db():
        print("[worker] database never became reachable — exiting", flush=True)
        sys.exit(1)

    ensure_history()
    run_models("startup")

    last_refresh = time.time()
    print(f"[worker] scheduled refresh every {REFRESH_SECONDS // 60} min; polling manual triggers", flush=True)
    while True:
        process_manual_triggers()
        if time.time() - last_refresh >= REFRESH_SECONDS:
            run_models("scheduled")
            last_refresh = time.time()
        time.sleep(30)


if __name__ == "__main__":
    main()
