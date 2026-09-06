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
dsn = os.environ["DATABASE_URL"].replace("postgresql+psycopg2://", "postgresql://", 1)
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
echo "[boot] Migrations complete. Seeding demo data: python seed.py"
python seed.py
echo "[boot] Seed complete. Starting Uvicorn on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
