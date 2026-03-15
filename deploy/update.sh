#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# CodFlow Quick Deploy — pull latest, rebuild, restart
# ═══════════════════════════════════════════════════════════════

APP_DIR="/opt/codflow"

echo "Pulling latest code..."
cd "$APP_DIR" && git pull origin main

echo "Installing backend deps..."
cd "$APP_DIR/backend" && npm ci --production

echo "Building frontend..."
cd "$APP_DIR/frontend" && npm ci && npm run build

echo "Reloading backend (zero-downtime)..."
cd "$APP_DIR/backend" && pm2 reload yahya-api

echo "Done! Check: pm2 logs yahya-api --lines 20"
