"""
run_pipeline.py — Master runner for the Q ME NOW ML pipeline.

Executes the full pipeline in order:
    1. Export CSVs from MySQL         (export_csv.py)
    2. Run notebook 01: Data health   (01_ingest_and_validate.ipynb)
    3. Run notebook 02: Ops insights  (02_admin_ops_insights.ipynb)
    4. Run notebook 03: Staff metrics (03_admin_staff_metrics.ipynb)
    5. Run notebook 04: Best time     (04_client_best_time.ipynb)
    6. Run notebook 05: Predictions   (05_predictive_model.ipynb)
    7. Import results to backend API  (import_predictions.py)

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

NOTEBOOKS_IN_ORDER = [
    '01_ingest_and_validate.ipynb',
    '02_admin_ops_insights.ipynb',
    '03_admin_staff_metrics.ipynb',
    '04_client_best_time.ipynb',
    '05_predictive_model.ipynb',
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
    try:
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


def main():
    parser = argparse.ArgumentParser(description='Q ME NOW — Full ML pipeline runner')
    parser.add_argument('--days',        type=int,   default=90,   help='Lookback days for export')
    parser.add_argument('--business-id', type=str,   default=None, help='Filter to one business')
    parser.add_argument('--dry-run',     action='store_true',       help='Skip import step')
    parser.add_argument('--skip-export', action='store_true',       help='Skip CSV export (use existing)')
    parser.add_argument('--skip-import', action='store_true',       help='Skip prediction import')
    args = parser.parse_args()

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
    nb_params = {}
    if args.business_id:
        nb_params['BUSINESS_ID'] = args.business_id
    nb_params['LOOKBACK_DAYS'] = args.days

    for notebook in NOTEBOOKS_IN_ORDER:
        nb_path = NOTEBOOKS_DIR / notebook
        if not nb_path.exists():
            log.warning(f'Notebook not found, skipping: {notebook}')
            continue
        ok = run_notebook(log, notebook, run_id, nb_params)
        if not ok:
            log.warning(f'Notebook {notebook} failed — continuing pipeline.')
            failures.append(notebook)

    # ── Step 7: Import predictions ────────────────────────────
    if not args.skip_import and not args.dry_run:
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
        log.warning(f'Pipeline completed with {len(failures)} failure(s): {", ".join(failures)}')
    else:
        log.info('Pipeline completed successfully.')
    log.info('=' * 60)


if __name__ == '__main__':
    main()
