#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CodFlow VPS Deployment Script — Ubuntu 22.04 / 24.04
# Domain: codflow.vip → 80.209.236.234
# Stack:  Node.js 22 + PM2 Cluster + Nginx + Redis + MongoDB
# ═══════════════════════════════════════════════════════════════════

DOMAIN="codflow.vip"
APP_DIR="/opt/codflow"
REPO_URL="https://github.com/aliatallaoui/yahyaknife.git"
NODE_VERSION=22

echo "══════════════════════════════════════════"
echo "  CodFlow VPS Setup — $DOMAIN"
echo "══════════════════════════════════════════"

# ── 1. System Update ─────────────────────────────────────────────
echo "[1/9] Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx ufw

# ── 2. Install Node.js 22 ───────────────────────────────────────
echo "[2/9] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt $NODE_VERSION ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# Install PM2 globally
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7

# ── 3. Install Docker (for MongoDB + Redis) ──────────────────────
echo "[3/9] Installing Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
echo "Docker: $(docker --version)"

# ── 4. Clone Repository ─────────────────────────────────────────
echo "[4/9] Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "  → $APP_DIR exists, pulling latest..."
    cd "$APP_DIR" && git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ── 5. Start MongoDB + Redis ─────────────────────────────────────
echo "[5/9] Starting MongoDB + Redis..."
cd "$APP_DIR/deploy"

# Generate secure MongoDB password if not set
if [ -z "${MONGO_PASS:-}" ]; then
    MONGO_PASS=$(openssl rand -hex 16)
    echo "  → Generated MongoDB password: $MONGO_PASS"
    echo "  → SAVE THIS PASSWORD!"
fi

MONGO_USER=yahya_admin MONGO_PASS=$MONGO_PASS docker compose up -d
echo "  → MongoDB on 127.0.0.1:27017, Redis on 127.0.0.1:6379"

# Wait for services to be healthy
echo "  → Waiting for services..."
sleep 10

# ── 6. Install Dependencies ─────────────────────────────────────
echo "[6/9] Installing dependencies..."
cd "$APP_DIR/backend" && npm ci --production
cd "$APP_DIR/frontend" && npm ci

# ── 7. Build Frontend ───────────────────────────────────────────
echo "[7/9] Building frontend..."
cd "$APP_DIR/frontend"
echo "VITE_API_URL=" > .env
npm run build
echo "  → Frontend built to dist/"

# ── 8. Backend Environment ───────────────────────────────────────
echo "[8/9] Configuring backend environment..."

# Generate keys
ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

cat > "$APP_DIR/backend/.env" << ENVEOF
NODE_ENV=production
PORT=5000

# MongoDB (local Docker)
MONGO_URI=mongodb://${MONGO_USER:-yahya_admin}:${MONGO_PASS}@127.0.0.1:27017/saas-dashboard?authSource=admin&replicaSet=rs0

# Redis (local Docker)
REDIS_URL=redis://127.0.0.1:6379

# Auth
JWT_SECRET=$JWT_SECRET

# CORS
CORS_ORIGIN=https://$DOMAIN,https://www.$DOMAIN

# Credential encryption
CREDENTIAL_ENCRYPTION_KEY=$ENCRYPTION_KEY

# WooCommerce OAuth
APP_NAME=CodFlow
APP_BASE_URL=https://$DOMAIN
API_BASE_URL=https://$DOMAIN

# Logging
LOG_LEVEL=info
ENVEOF

echo "  → .env configured (update AI keys manually)"

# ── 9. Nginx + PM2 + Firewall ────────────────────────────────────
echo "[9/9] Configuring Nginx, PM2, Firewall..."

# Nginx — use the optimized config
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/codflow
ln -sf /etc/nginx/sites-available/codflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
sed -i "s/yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/codflow
sed -i "s|/var/www/yahya|$APP_DIR|g" /etc/nginx/sites-available/codflow
nginx -t && systemctl restart nginx

# Create log directory
mkdir -p /var/log/yahya

# PM2 — start with cluster mode
cd "$APP_DIR/backend"
pm2 delete yahya-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

echo ""
echo "══════════════════════════════════════════"
echo "  Setup Complete!"
echo "══════════════════════════════════════════"
echo ""
echo "  App running at:  http://$DOMAIN"
echo "  API health:      http://$DOMAIN/health"
echo "  PM2 status:      pm2 status"
echo "  PM2 logs:        pm2 logs yahya-api"
echo "  Docker services: cd $APP_DIR/deploy && docker compose ps"
echo ""
echo "  ⚠ NEXT STEPS:"
echo "  1. Set DNS A record: $DOMAIN → your VPS IP"
echo "  2. Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Add your AI keys to $APP_DIR/backend/.env"
echo "  4. If migrating from Atlas, update MONGO_URI in .env"
echo ""
