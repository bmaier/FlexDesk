#!/usr/bin/env bash
# DeskSharing BAMF — PoC Startskript.
# Startet Backend (FastAPI, uv-verwaltetes venv) und Frontend (Vite, neueste Node-LTS via nvm)
# und beendet beide sauber bei Strg+C.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8010}"
FRONTEND_PORT="${FRONTEND_PORT:-5183}"

echo "==> DeskSharing BAMF PoC wird gestartet…"

if ! command -v uv >/dev/null 2>&1; then
  echo "Fehler: 'uv' wurde nicht gefunden. Installation: https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm install --lts >/dev/null
  nvm use --lts
else
  echo "Hinweis: nvm nicht gefunden unter ~/.nvm — verwende das aktuell aktive Node (siehe README)."
fi

echo "==> Backend-Abhängigkeiten (uv sync)…"
(cd "$BACKEND_DIR" && uv sync --quiet)

echo "==> Frontend-Abhängigkeiten (npm install)…"
(cd "$FRONTEND_DIR" && npm install --silent)

cleanup() {
  echo
  echo "==> Beende Backend/Frontend…"
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starte Backend auf Port $BACKEND_PORT (Log: /tmp/deskshare-backend.log)…"
(cd "$BACKEND_DIR" && uv run uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload) > /tmp/deskshare-backend.log 2>&1 &
BACKEND_PID=$!

echo "==> Warte auf Backend-Health-Check…"
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Starte Frontend auf Port $FRONTEND_PORT (Log: /tmp/deskshare-frontend.log)…"
(cd "$FRONTEND_DIR" && npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort) > /tmp/deskshare-frontend.log 2>&1 &
FRONTEND_PID=$!

echo
echo "=================================================================="
echo " DeskSharing BAMF läuft:"
echo "   Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "   Backend:  http://127.0.0.1:$BACKEND_PORT/docs (OpenAPI)"
echo
echo " Demo-Ablauf ausführen (in einem zweiten Terminal):"
echo "   cd backend && uv run python demo_walkthrough.py"
echo
echo " Strg+C zum Beenden."
echo "=================================================================="

wait
