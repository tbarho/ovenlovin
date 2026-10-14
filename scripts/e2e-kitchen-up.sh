#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin}"
export E2E_AUTH_BYPASS="${E2E_AUTH_BYPASS:-1}"

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$root/docker-compose.e2e.yml" up -d
  for _ in $(seq 1 30); do
    if docker compose -f "$root/docker-compose.e2e.yml" exec -T postgres pg_isready -U ovenlovin -d ovenlovin >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker is not available. Using DATABASE_URL=$DATABASE_URL"
fi

pnpm --filter @ovenlovin/db db:migrate:deploy
pnpm --filter @ovenlovin/web e2e:kitchen:seed
echo "E2E kitchen is ready. Start the app with:"
echo "  E2E_AUTH_BYPASS=1 DATABASE_URL=$DATABASE_URL pnpm --filter @ovenlovin/web dev"
