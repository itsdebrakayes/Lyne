"""
run_pipeline.py — Master runner for the Q ME NOW ML pipeline.

Executes the production pipeline in order:
    1. Export tenant-scoped CSVs from MySQL (export_csv.py)
    2. Run notebook 05: Predictions         (05_predictive_model.ipynb)
    3. Import results to backend API        (import_predictions.py)

Usage:
    python scripts/run_pipeline.py [--days N] [--business-id UUID] [--dry-run]

Requirements:
    pip install papermill jupyter nbconvert mysql-connector-python python-dotenv requests

Logs to: outputs/pipeline_run_YYYYMMDD_HHMMSS.log
"""

import os
import sys
import argparse
import subprocess
import logging
from datetime import datetime
from pathlib import Path

BASE_DIR      = Path(__file__).parent.parent
NOTEBOOKS_DIR = BASE_DIR / 'notebooks'
OUTPUTS_DIR   = BASE_DIR / 'outputs'
SCRIPTS_DIR   = BASE_DIR / 'scripts'
LOG_DIR       = OUTPUTS_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

# The first four notebooks belong to the retired Supabase Storage prototype.
# Production uses MySQL-shaped notebooks exclusively.
NOTEBOOKS_IN_ORDER = ['05_predictive_model.ipynb', '06_manager_performance.ipynb']

# DB-connected model scripts. Each trains/scores against MySQL and upserts its
# insights straight into predictive_results (--write-db), so they run as their
# own phase rather than through the CSV → API import path. Order is dependency
# free; grouped by role (customer ETA → demand → staffing → risk → executive).
MODEL_SCRIPTS_IN_ORDER = [
    'generate_insights.py',              # wait_eta_grid, service_time, wait/abandonment, model_perf
    'forecast_demand.py',                # demand_forecast
    'recommend_staffing.py',             # staffing_recommendation
    'predict_no_show.py',                # no_show_risk
    'forecast_targets.py',               # target_attainment
    'detect_operational_anomalies.py',   # operational_anomalies
]


def setup_logging(run_id: str) -> logging.Logger:
    log_file = LOG_DIR / f'pipeline_run_{run_id}.log'
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s  %(levelname)-8s  %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout),
        ]
    )
    logger = logging.getLogger('pipeline')
    logger.info(f'Log file: {log_file}')
    return logger


def run_script(log: logging.Logger, script: str, extra_args: list = None) -> bool:
    cmd = [sys.executable, str(SCRIPTS_DIR / script)] + (extra_args or [])
    log.info(f'Running: {" ".join(cmd)}')
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        log.error(f'{script} exited with code {result.returncode}')
        return False
    return True


def run_notebook(log: logging.Logger, notebook: str, output_suffix: str,
                 parameters: dict = None) -> bool:
    try:
        import papermill as pm
    except ImportError:
        log.error('papermill not installed. Run: pip install papermill')
        return False

    nb_in  = str(NOTEBOOKS_DIR / notebook)
    nb_out = str(OUTPUTS_DIR / 'executed' / f'{notebook.replace(".ipynb", "")}_{output_suffix}.ipynb')
    Path(nb_out).parent.mkdir(parents=True, exist_ok=True)

    log.info(f'Executing notebook: {notebook}')
    previous_cwd = Path.cwd()
    try:
        os.chdir(NOTEBOOKS_DIR)
        pm.execute_notebook(
            input_path=nb_in,
            output_path=nb_out,
            parameters=parameters or {},
            kernel_name='python3',
            progress_bar=True,
        )
        log.info(f'  Done → {nb_out}')
        return True
    except Exception as e:
        log.error(f'  Notebook failed: {e}')
        return False
    finally:
        os.chdir(previous_cwd)


def main():
    parser = argparse.ArgumentParser(description='Q ME NOW — Full ML pipeline runner')
    parser.add_argument('--days',        type=int,   default=90,   help='Lookback days for export')
    parser.add_argument('--business-id', type=str,   default=None, help='Filter to one business')
    parser.add_argument('--dry-run',     action='store_true',       help='Skip import step')
    parser.add_argument('--skip-export', action='store_true',       help='Skip CSV export (use existing)')
    parser.add_argument('--skip-import', action='store_true',       help='Skip prediction import')
    args = parser.parse_args()

    if not args.business_id and (not args.skip_export or (not args.skip_import and not args.dry_run)):
        parser.error('--business-id is required for every tenant-scoped production run')

    run_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    log    = setup_logging(run_id)

    log.info('=' * 60)
    log.info('Q ME NOW — ML Pipeline')
    log.info(f'Run ID      : {run_id}')
    log.info(f'Lookback    : {args.days} days')
    log.info(f'Business ID : {args.business_id or "ALL"}')
    log.info(f'Dry run     : {args.dry_run}')
    log.info('=' * 60)

    failures = []

    # ── Step 1: Export CSVs ───────────────────────────────────
    if not args.skip_export:
        export_args = ['--days', str(args.days)]
        if args.business_id:
            export_args += ['--business-id', args.business_id]
        if not run_script(log, 'export_csv.py', export_args):
            log.error('Export failed — aborting pipeline.')
            sys.exit(1)
    else:
        log.info('Skipping CSV export (--skip-export).')

    # ── Steps 2-6: Notebooks ──────────────────────────────────
    for notebook in NOTEBOOKS_IN_ORDER:
        nb_path = NOTEBOOKS_DIR / notebook
        if not nb_path.exists():
            log.warning(f'Notebook not found, skipping: {notebook}')
            continue
        ok = run_notebook(log, notebook, run_id)
        if not ok:
            log.error(f'Notebook {notebook} failed — import will not run.')
            failures.append(notebook)

    # ── Model scripts: train + upsert insights directly ───────
    if not args.dry_run:
        for script in MODEL_SCRIPTS_IN_ORDER:
            if not (SCRIPTS_DIR / script).exists():
                log.warning(f'Model script not found, skipping: {script}')
                continue
            if not run_script(log, script, ['--write-db']):
                log.error(f'Model script {script} failed.')
                failures.append(script)
    else:
        log.info('Dry run — skipping model scripts (no DB writes).')

    # ── Step 7: Import predictions ────────────────────────────
    if failures:
        log.error('One or more model steps failed. Refusing to import stale or partial output.')
    elif not args.skip_import and not args.dry_run:
        import_args = []
        if args.business_id:
            import_args += ['--business-id', args.business_id]
        import_args += ['--model-version', run_id]
        if not run_script(log, 'import_predictions.py', import_args):
            failures.append('import_predictions.py')
    elif args.dry_run:
        log.info('Dry run — skipping import.')

    # ── Summary ───────────────────────────────────────────────
    log.info('=' * 60)
    if failures:
        log.error(f'Pipeline failed with {len(failures)} failure(s): {", ".join(failures)}')
        sys.exit(1)
    else:
        log.info('Pipeline completed successfully.')
    log.info('=' * 60)


if __name__ == '__main__':
    main()
