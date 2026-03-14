#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════
# CodFlow VPS Deployment Script — Ubuntu 22.04 / Debian
# Domain: codflow.vip → 80.209.236.234
# Stack:  Node.js 20 + PM2 + Nginx + Certbot + MongoDB Atlas
# ═══════════════════════════════════════════════════════════════════

DOMAIN="codflow.vip"
APP_DIR="/opt/codflow"
REPO_URL="https://github.com/aliatallaoui/yahyaknife.git"
NODE_VERSION=20

echo "══════════════════════════════════════════"
echo "  CodFlow VPS Setup — $DOMAIN"
echo "══════════════════════════════════════════"

# ── 1. System Update ─────────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx ufw

# ── 2. Install Node.js 20 ───────────────────────────────────────
echo "[2/8] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt $NODE_VERSION ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# Install PM2 globally
npm install -g pm2

# ── 3. Clone Repository ─────────────────────────────────────────
echo "[3/8] Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "  → $APP_DIR exists, pulling latest..."
    cd "$APP_DIR" && git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ── 4. Install Dependencies ─────────────────────────────────────
echo "[4/8] Installing dependencies..."
cd "$APP_DIR/backend" && npm ci --production
cd "$APP_DIR/frontend" && npm ci

# ── 5. Build Frontend ───────────────────────────────────────────
echo "[5/8] Building frontend..."
cd "$APP_DIR/frontend"
echo "VITE_API_URL=" > .env
npm run build
echo "  → Frontend built to dist/"

# ── 6. Backend Environment ───────────────────────────────────────
echo "[6/8] Configuring backend environment..."
cat > "$APP_DIR/backend/.env" << 'ENVEOF'
NODE_ENV=production
PORT=5000

# MongoDB Atlas
MONGO_URI=mongodb://yahyaknife_db_user:bIAt9KaxaJbS24xj@ac-f20sful-shard-00-00.sacozgo.mongodb.net:27017,ac-f20sful-shard-00-01.sacozgo.mongodb.net:27017,ac-f20sful-shard-00-02.sacozgo.mongodb.net:27017/saas-dashboard?ssl=true&replicaSet=atlas-ynzj40-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0

# Auth
JWT_SECRET=78d798e30220b498dc960fa89f19336e521be3ca9ce125fb384c719b60562c87

# CORS — allow your domain
CORS_ORIGIN=https://codflow.vip,https://www.codflow.vip

# AI Keys
GEMINI_API_KEY=AIzaSyCwqhlqRF4EgBKSOOi1QmeVVoT1yjeLcdk

# Credential encryption (generate fresh 32-byte key)
CREDENTIAL_ENCRYPTION_KEY=REPLACE_ME_RUN_openssl_rand_hex_32

# WooCommerce OAuth
APP_NAME=CodFlow
APP_BASE_URL=https://codflow.vip
API_BASE_URL=https://codflow.vip

# Logging
LOG_LEVEL=info
ENVEOF

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
sed -i "s/REPLACE_ME_RUN_openssl_rand_hex_32/$ENCRYPTION_KEY/" "$APP_DIR/backend/.env"
echo "  → Generated CREDENTIAL_ENCRYPTION_KEY"

# ── 7. Nginx Configuration ──────────────────────────────────────
echo "[7/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/codflow << 'NGINXEOF'
server {
    listen 80;
    server_name codflow.vip www.codflow.vip;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API → Backend (Node.js on port 5000)
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend static files
    location / {
        root /opt/codflow/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets aggressively
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}
NGINXEOF

# Enable site, disable default
ln -sf /etc/nginx/sites-available/codflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl restart nginx
echo "  → Nginx configured"

# ── 8. PM2 Process Manager ──────────────────────────────────────
echo "[8/8] Starting backend with PM2..."
cd "$APP_DIR/backend"

cat > "$APP_DIR/ecosystem.config.js" << 'PM2EOF'
module.exports = {
    apps: [{
        name: 'codflow-api',
        script: 'server.js',
        cwd: '/opt/codflow/backend',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production'
        },
        max_memory_restart: '500M',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: '/var/log/codflow/error.log',
        out_file: '/var/log/codflow/out.log',
        merge_logs: true,
        watch: false,
        max_restarts: 10,
        restart_delay: 5000
    }]
};
PM2EOF

# Create log directory
mkdir -p /var/log/codflow

# Start/Restart the app
pm2 delete codflow-api 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ── 9. Firewall ─────────────────────────────────────────────────
echo "Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# ── 10. SSL Certificate ─────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Setup Complete!"
echo "══════════════════════════════════════════"
echo ""
echo "  App running at: http://$DOMAIN"
echo "  API health:     http://$DOMAIN/health"
echo "  PM2 status:     pm2 status"
echo "  PM2 logs:       pm2 logs codflow-api"
echo ""
echo "  ⚠ NEXT: Once DNS is propagated, run:"
echo "  certbot --nginx -d codflow.vip -d www.codflow.vip"
echo ""
echo "  This will enable HTTPS (required for WooCommerce OAuth)."
echo ""
