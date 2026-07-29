# Q Me Now — live model worker.
# Runs the six model scripts against the DB on boot and on a schedule so
# predictive_results is produced by the models, not seeded. Lean by design:
# scripts only, no Jupyter / papermill / matplotlib.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements-worker.txt ./
RUN pip install --no-cache-dir -r requirements-worker.txt

COPY scripts ./scripts
COPY utils ./utils
RUN mkdir -p outputs/admin

CMD ["python", "scripts/live_worker.py"]
