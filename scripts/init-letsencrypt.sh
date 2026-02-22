#!/bin/bash
# NovaPress AI v2 - Let's Encrypt SSL Certificate Initialization
# Usage: sudo bash scripts/init-letsencrypt.sh
#
# This script:
# 1. Creates a dummy self-signed certificate so nginx can start
# 2. Starts nginx with the dummy cert
# 3. Requests a real certificate from Let's Encrypt via certbot
# 4. Replaces the dummy cert with the real one
# 5. Reloads nginx to use the real certificate
#
# Prerequisites:
# - Docker and Docker Compose installed
# - Port 80 open to the internet (for ACME challenge)
# - DNS record for novapressai.duckdns.org pointing to this server

set -euo pipefail

# --- Configuration ---
DOMAIN="novapressai.duckdns.org"
EMAIL="admin@novapressai.duckdns.org"  # Change to your real email
COMPOSE_FILE="docker-compose.prod.yml"
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"

# Use staging server for testing (set to 0 for production)
# Let's Encrypt has rate limits: 5 certs per domain per week
# Use staging=1 first to verify everything works, then set to 0
STAGING=${STAGING:-0}

# --- Colors for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Pre-flight checks ---
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose V2 is not available. Please update Docker."
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "$COMPOSE_FILE not found. Run this script from the project root."
    exit 1
fi

# --- Check if certificates already exist ---
if [ -d "./certbot/conf/live/$DOMAIN" ]; then
    log_warn "Certificates already exist for $DOMAIN."
    read -p "Do you want to replace them? (y/N) " decision
    if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
        log_info "Keeping existing certificates. Exiting."
        exit 0
    fi
fi

log_info "=== NovaPress SSL Certificate Setup ==="
log_info "Domain: $DOMAIN"
log_info "Email: $EMAIL"
log_info "Staging: $([ "$STAGING" -eq 1 ] && echo 'YES (test mode)' || echo 'NO (production)')"
echo ""

# --- Step 1: Create required directories ---
log_info "Step 1/6: Creating certificate directories..."
mkdir -p "./certbot/conf"
mkdir -p "./certbot/www"

# --- Step 2: Download recommended TLS parameters ---
log_info "Step 2/6: Downloading recommended TLS parameters..."
if [ ! -e "./certbot/conf/options-ssl-nginx.conf" ] || [ ! -e "./certbot/conf/ssl-dhparams.pem" ]; then
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./certbot/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./certbot/conf/ssl-dhparams.pem"
    log_info "TLS parameters downloaded."
else
    log_info "TLS parameters already exist. Skipping."
fi

# --- Step 3: Create dummy certificate ---
log_info "Step 3/6: Creating dummy certificate for nginx to start..."
CERT_PATH="./certbot/conf/live/$DOMAIN"
mkdir -p "$CERT_PATH"

# Generate self-signed dummy certificate
openssl req -x509 -nodes -newkey rsa:2048 \
    -days 1 \
    -keyout "$CERT_PATH/privkey.pem" \
    -out "$CERT_PATH/fullchain.pem" \
    -subj "/CN=localhost" \
    2>/dev/null

# Create chain.pem (copy of fullchain for OCSP stapling)
cp "$CERT_PATH/fullchain.pem" "$CERT_PATH/chain.pem"

log_info "Dummy certificate created."

# --- Step 4: Start nginx with dummy certificate ---
log_info "Step 4/6: Starting nginx with dummy certificate..."

# We need to temporarily modify the compose file to mount our local certbot dirs
# instead of using Docker volumes. Create a compose override.
cat > docker-compose.override.yml << 'EOF'
services:
  nginx:
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
  certbot:
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
EOF

# Start only nginx (and its dependencies)
docker compose -f "$COMPOSE_FILE" -f docker-compose.override.yml up -d nginx
log_info "Waiting for nginx to be ready..."
sleep 5

# Verify nginx is running
if ! docker compose -f "$COMPOSE_FILE" -f docker-compose.override.yml ps nginx | grep -q "Up\|running"; then
    log_error "Nginx failed to start. Check logs with: docker compose -f $COMPOSE_FILE logs nginx"
    exit 1
fi
log_info "Nginx is running."

# --- Step 5: Delete dummy certificate and request real one ---
log_info "Step 5/6: Requesting real certificate from Let's Encrypt..."

# Remove dummy certificate
rm -rf "$CERT_PATH"

# Build certbot command
CERTBOT_ARGS=(
    certonly
    --webroot
    -w /var/www/certbot
    -d "$DOMAIN"
    --email "$EMAIL"
    --rsa-key-size "$RSA_KEY_SIZE"
    --agree-tos
    --no-eff-email
    --force-renewal
)

# Add staging flag if in test mode
if [ "$STAGING" -eq 1 ]; then
    CERTBOT_ARGS+=(--staging)
    log_warn "Using Let's Encrypt STAGING server (certificates will NOT be trusted)."
fi

# Request the certificate
docker compose -f "$COMPOSE_FILE" -f docker-compose.override.yml run --rm certbot "${CERTBOT_ARGS[@]}"

if [ $? -ne 0 ]; then
    log_error "Certificate request failed!"
    log_error "Common causes:"
    log_error "  - Port 80 is not open to the internet"
    log_error "  - DNS for $DOMAIN does not point to this server"
    log_error "  - Let's Encrypt rate limit exceeded (try STAGING=1)"
    exit 1
fi

log_info "Certificate obtained successfully!"

# --- Step 6: Reload nginx with real certificate ---
log_info "Step 6/6: Reloading nginx with real certificate..."
docker compose -f "$COMPOSE_FILE" -f docker-compose.override.yml exec nginx nginx -s reload

# Clean up override file
rm -f docker-compose.override.yml

log_info ""
log_info "=== SSL Setup Complete ==="
log_info ""
log_info "Your site is now available at: https://$DOMAIN"
log_info ""
if [ "$STAGING" -eq 1 ]; then
    log_warn "You used the STAGING server. Certificates are NOT trusted by browsers."
    log_warn "Once you verify everything works, run again with STAGING=0:"
    log_warn "  STAGING=0 sudo bash scripts/init-letsencrypt.sh"
fi
log_info ""
log_info "To start all services:"
log_info "  docker compose -f $COMPOSE_FILE up -d"
log_info ""
log_info "Certificate auto-renewal is handled by the certbot container."
log_info "Nginx reloads every 6 hours to pick up renewed certificates."
log_info ""
log_info "To manually renew: docker compose -f $COMPOSE_FILE run --rm certbot renew"
log_info "To check cert expiry: docker compose -f $COMPOSE_FILE run --rm certbot certificates"
