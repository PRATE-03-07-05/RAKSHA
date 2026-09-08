#!/bin/sh
# RAKSHA backend startup — resilient to the Docker DNS / DB readiness window.
#
# `depends_on: service_healthy` gates on pg_isready INSIDE the db container,
# but the `db` hostname can take a moment to resolve from a freshly started
# backend container ("Temporary failure in name resolution"). This script
# therefore waits for a real end-to-end connection (DNS + TCP + auth + query)
# from THIS container before touching Alembic, seed or Uvicorn.
#
# `set -e` aborts boot on any real failure (migration/seed crash). The wait
# loop is unaffected: commands inside an `until` condition are exempt.

set -e

echo "[boot] RAKSHA backend starting..."

attempts=0
max_attempts=60   # 60 x 2s => wait up to ~2 minutes before giving up

until python - <<'PY'
import os, sys
import psycopg2

# libpq wants the plain scheme; strip the SQLAlchemy driver suffix.
_dbu = os.environ.get("DATABASE_URL", "")
if not _dbu:
    print("[boot] ERROR: DATABASE_URL is not set — aborting.", flush=True)
    sys.exit(2)
dsn = _dbu.replace("postgresql+psycopg2://", "postgresql://", 1)
try:
    conn = psycopg2.connect(dsn, connect_timeout=3)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    finally:
        conn.close()
    sys.exit(0)
except Exception as exc:  # DNS not resolvable yet, TCP refused, auth pending...
    print(f"[boot]   waiting for PostgreSQL: {exc}", flush=True)
    sys.exit(1)
PY
do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge "$max_attempts" ]; then
    echo "[boot] ERROR: PostgreSQL was not reachable after $max_attempts attempts — aborting." >&2
    exit 1
  fi
  sleep 2
done

echo "[boot] PostgreSQL is reachable (host 'db' resolved, auth OK)."
echo "[boot] Running Alembic migrations: alembic upgrade head"
alembic upgrade head
# Seed only when explicitly enabled (never seed weak demo creds in production).
if [ "${RAKSHA_SEED_DEMO:-false}" = "true" ]; then
  echo "[boot] Migrations complete. Seeding demo data: python seed.py"
  python seed.py
  echo "[boot] Seed complete."
else
  echo "[boot] Skipping demo seed (RAKSHA_SEED_DEMO!=true)."
fi

# First-run ML triage model training (only if no artifact is present). The
# synthetic, clearly-labelled dev dataset is used. A failure here never blocks
# startup — the API transparently falls back to the rule-based engine.
# Never train prod on synthetic data: require explicit opt-in.
if [ ! -f ml/models/triage_model.joblib ]; then
  if [ "${RAKSHA_TRAIN_SYNTHETIC:-false}" = "true" ]; then
    echo "[boot] No ML triage model found — training on the synthetic set (first run only)..."
    python -m ml.training.train --synthetic \
      || echo "[boot] WARNING: ML training failed — the rule-based fallback will serve triage."
  else
    echo "[boot] No ML model found — synthetic training disabled (RAKSHA_TRAIN_SYNTHETIC!=true); using rule fallback."
  fi
else
  echo "[boot] ML triage model already present — skipping training."
fi

echo "[boot] Starting Uvicorn on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
