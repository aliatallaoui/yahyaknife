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

echo "Restarting backend..."
pm2 restart codflow-api

echo "Done! Check: pm2 logs codflow-api --lines 20"
