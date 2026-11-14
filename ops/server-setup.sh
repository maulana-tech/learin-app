#!/usr/bin/env bash
# First-boot setup for a fresh Ubuntu 24.04 EC2 instance running LEARIS.
# Paste this whole file into "Advanced details → User data" when launching the instance
# (it runs once, as root). Progress: /var/log/cloud-init-output.log on the server.
#
# It installs Docker, nginx and certbot, adds swap, writes the nginx sites for
#   learis.lumbungstack.dev       → the web app      (127.0.0.1:3000)
#   api.learis.lumbungstack.dev   → the agent service (127.0.0.1:8787)
# and creates /opt/learis/learis/agent/.env with a fresh LEARIS_SECRET.
# HTTPS comes after DNS points here: sudo certbot --nginx -d learis.lumbungstack.dev -d api.learis.lumbungstack.dev
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

WEB_HOST=learis.lumbungstack.dev
API_HOST=api.learis.lumbungstack.dev
APP_DIR=/opt/learis

apt-get update -y
apt-get install -y ca-certificates curl nginx certbot python3-certbot-nginx

# Docker Engine + the compose plugin, from Docker's own repository
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker ubuntu
systemctl enable --now docker

# 2 GB of swap: a small instance would otherwise run out of memory pulling images
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The app directory the deploy script writes into, owned by the deploy user
mkdir -p "$APP_DIR/learis/agent"
if [[ ! -f $APP_DIR/learis/agent/.env ]]; then
  cat > "$APP_DIR/learis/agent/.env" <<ENV
LEARIS_ENV=prod
LEARIS_SECRET=$(openssl rand -hex 32)
LEARIS_AUTO_DELETE=1
# A model for everyone without their own key (optional):
# AWS_BEARER_TOKEN_BEDROCK=
# LEARIS_BEDROCK_REGION=ap-southeast-2
ENV
  chmod 600 "$APP_DIR/learis/agent/.env"
fi
chown -R ubuntu:ubuntu "$APP_DIR"

# nginx: one site for the web app, one for the agent API
cat > /etc/nginx/conf.d/learis-limits.conf <<'NGINX'
limit_req_zone $binary_remote_addr zone=learis_auth:10m rate=10r/m;
NGINX

cat > /etc/nginx/sites-available/learis <<NGINX
server {
    listen 80;
    server_name $WEB_HOST;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 660s;
        proxy_send_timeout 660s;
    }
}
NGINX

cat > /etc/nginx/sites-available/learis-api <<NGINX
server {
    listen 80;
    server_name $API_HOST;
    client_max_body_size 10m;
    location ~ ^/(login|signup)\$ {
        limit_req zone=learis_auth burst=10 nodelay;
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 660s;
        proxy_send_timeout 660s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/learis /etc/nginx/sites-enabled/learis
ln -sf /etc/nginx/sites-available/learis-api /etc/nginx/sites-enabled/learis-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "LEARIS server setup finished"
