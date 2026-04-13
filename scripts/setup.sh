#!/usr/bin/env bash
# ServeEase — one-shot dev setup script
# Run from the repo root: bash scripts/setup.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $1"; }

log "ServeEase setup starting from $ROOT"

# ─── Check prerequisites ───────────────────────────────────────────────────────
for cmd in node npm docker docker-compose; do
  if ! command -v "$cmd" &>/dev/null; then
    warn "$cmd not found — please install it before continuing."
    exit 1
  fi
done

log "All prerequisites found"

# ─── Install shared package ───────────────────────────────────────────────────
log "Installing shared package..."
cd "$ROOT/shared"
npm install
npm run build 2>/dev/null || true

# ─── Install each service ─────────────────────────────────────────────────────
SERVICES=(
  auth-service
  user-service
  worker-service
  catalog-service
  booking-service
  payment-service
  notification-service
  review-service
  admin-service
)

for svc in "${SERVICES[@]}"; do
  log "Installing $svc..."
  cd "$ROOT/services/$svc"
  npm install
done

# ─── Copy .env files if they don't exist ──────────────────────────────────────
log "Setting up .env files..."
for svc in "${SERVICES[@]}"; do
  ENV_FILE="$ROOT/services/$svc/.env"
  EXAMPLE="$ROOT/services/$svc/.env.example"
  if [ ! -f "$ENV_FILE" ] && [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    warn "Copied .env.example → .env for $svc — update with your real credentials!"
  fi
done

# ─── Generate admin password hash ─────────────────────────────────────────────
log "Generating admin password hash..."
node "$ROOT/scripts/generate-admin-hash.js"

# ─── Done ─────────────────────────────────────────────────────────────────────
log ""
log "✓ Setup complete! Next steps:"
log "  1. Fill in real credentials in each services/*.env file"
log "  2. Run: docker-compose up --build"
log "  3. Admin panel: http://localhost/admin"
log "  4. RabbitMQ UI: http://localhost:15672 (serveease / serveease123)"
