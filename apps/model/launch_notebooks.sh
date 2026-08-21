#!/usr/bin/env bash
# Launch all Lyne notebooks in the browser (JupyterLab), wired to the demo DB.
#
#   cd apps/model && ./launch_notebooks.sh
#
# Requires: the demo stack running (docker compose ... demo-db on :3308) and the
# .venv created (python -m venv .venv && pip install -r requirements.txt).
set -euo pipefail
cd "$(dirname "$0")"                        # -> apps/model

# 1. Activate the virtualenv
if [ ! -d .venv ]; then
  echo "No .venv found. Create it first:  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
source .venv/bin/activate

# 2. Make sure JupyterLab is installed in the venv
python -c "import jupyterlab" 2>/dev/null || { echo "Installing JupyterLab…"; pip install -q jupyterlab; }

# 3. Load the demo DB connection env (.env) so every notebook connects to :3308
set -a; source .env; set +a

# 4. Notebooks 05 & 06 read exported CSVs — generate them for the demo business first
echo "Exporting demo data for ${PIPELINE_BUSINESS_ID}…"
python scripts/export_csv.py --business-id "${PIPELINE_BUSINESS_ID}" --days 120 || \
  echo "  (export skipped — 07–12 still run; 05/06 need this CSV export)"

# 5. Start JupyterLab (local, no token) and open every notebook as its own tab
PORT="${JUPYTER_PORT:-8888}"
echo "Starting JupyterLab on http://localhost:${PORT} …"
jupyter lab --port "${PORT}" --no-browser \
  --ServerApp.token='' --ServerApp.password='' \
  --ServerApp.root_dir="$(pwd)" > /tmp/qme_jupyter.log 2>&1 &
sleep 5

open_cmd="open"; command -v xdg-open >/dev/null 2>&1 && open_cmd="xdg-open"
for nb in notebooks/05_predictive_model.ipynb \
          notebooks/06_manager_performance.ipynb \
          notebooks/07_dashboard_insights.ipynb \
          notebooks/08_demand_forecast.ipynb \
          notebooks/09_staffing_recommendation.ipynb \
          notebooks/10_no_show_risk.ipynb \
          notebooks/11_target_attainment.ipynb \
          notebooks/12_operational_anomalies.ipynb; do
  "$open_cmd" "http://localhost:${PORT}/lab/tree/${nb}" >/dev/null 2>&1 || true
  sleep 0.4
done

echo
echo "JupyterLab is running at:  http://localhost:${PORT}/lab"
echo "Each notebook opened as a tab. In each: Run ▸ Run All Cells."
echo "Set WRITE_DB=1 before launching to also upsert insights into predictive_results."
echo "Server log: /tmp/qme_jupyter.log   ·   Stop it with: jupyter lab stop ${PORT}"
