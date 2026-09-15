#!/usr/bin/env bash
# Deploys solidchat-ai on THIS server: git pull -> build -> restart systemd services.
# Bare-metal (no Docker) production layout — see memory "public-deployment" / docs/deployment.md.
#
# Usage: sudo scripts/deploy.sh [--skip-pull] [--dry-run]

set -euo pipefail

DRY_RUN=false
SKIP_PULL=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-pull) SKIP_PULL=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SERVICES=(solidchat-api solidchat-worker solidchat-dashboard)

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

# --- Safety guard: refuse to run anywhere that isn't this server's real deployment. ---
if [[ "$REPO_ROOT" != "/srv/live-chat" ]]; then
  echo "Refusing to run: expected repo at /srv/live-chat, found $REPO_ROOT." >&2
  echo "This script is wired to this server's systemd units — do not run it on a local/dev checkout." >&2
  exit 1
fi

for svc in "${SERVICES[@]}"; do
  if [[ -z "$(systemctl list-unit-files "${svc}.service" 2>/dev/null | grep "${svc}.service")" ]]; then
    echo "Refusing to run: systemd unit ${svc}.service not found on this machine." >&2
    echo "This looks like a local/dev environment, not the production server." >&2
    exit 1
  fi
done

if [[ $EUID -ne 0 ]]; then
  echo "Refusing to run: this script needs root (systemctl restart, service log paths)." >&2
  echo "Re-run with sudo." >&2
  exit 1
fi

echo "== Deploying solidchat-ai in $REPO_ROOT =="

if ! $SKIP_PULL; then
  run git pull --ff-only origin dev
fi

run corepack enable
run corepack prepare pnpm@9.12.0 --activate
run pnpm install --no-frozen-lockfile

# packages/database/.env shadows the root .env at import time — keep them in sync (see memory gotcha).
run cp .env packages/database/.env

run pnpm --filter @solidchat/database generate
run pnpm --filter @solidchat/database exec prisma migrate deploy

run pnpm -r build

echo "== Restarting services =="
run systemctl restart "${SERVICES[@]}"

echo "== Health check =="
if ! $DRY_RUN; then
  sleep 2
  curl -sf http://127.0.0.1:4000/health && echo " api: OK" || echo " api: FAILED"
  curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 && echo " dashboard: OK" || echo " dashboard: FAILED"
fi

echo "== Done =="
echo "Note: widget is static (nginx serves apps/widget/dist) — no service restart needed, the rebuild above already refreshed it."
