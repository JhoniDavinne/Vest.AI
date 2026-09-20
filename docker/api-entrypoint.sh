#!/bin/sh
# Entrypoint da API: aguarda o banco + migrations (app/prestart.py) e sobe o uvicorn.
# Sem sleeps arbitrarios: o prestart faz polling com timeout (VESTE_DB_WAIT_SECONDS).
set -eu

python -m app.prestart

exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${VESTE_UVICORN_WORKERS:-1}" \
  --timeout-keep-alive "${VESTE_UVICORN_TIMEOUT_KEEP_ALIVE:-75}" \
  --proxy-headers \
  --forwarded-allow-ips "${VESTE_FORWARDED_ALLOW_IPS:-*}" \
  --no-access-log
