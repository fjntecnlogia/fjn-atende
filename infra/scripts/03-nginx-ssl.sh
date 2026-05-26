#!/usr/bin/env bash
# =====================================================================
# Configura Nginx + Certbot (HTTPS) pros 3 subdomínios FJN
#
# Pré-requisito: DNS já apontando para o IP da VPS:
#   wa.fjntecnologia.com.br         → IP
#   api-painel.fjntecnologia.com.br → IP
#   evolution.fjntecnologia.com.br  → IP
#
# Uso (como root ou sudo):
#   sudo DOMAIN=fjntecnologia.com.br EMAIL=fjntecnologia2022@gmail.com ./03-nginx-ssl.sh
# =====================================================================
set -euo pipefail

DOMAIN="${DOMAIN:?defina DOMAIN, ex: DOMAIN=fjntecnologia.com.br}"
EMAIL="${EMAIL:?defina EMAIL, ex: EMAIL=voce@gmail.com}"

WA_HOST="wa.${DOMAIN}"
API_HOST="api-painel.${DOMAIN}"
EV_HOST="evolution.${DOMAIN}"

cat > /etc/nginx/sites-available/fjn-atendimento <<EOF
server {
    listen 80;
    server_name ${WA_HOST};
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF

cat > /etc/nginx/sites-available/fjn-painel-api <<EOF
server {
    listen 80;
    server_name ${API_HOST};
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
    }
}
EOF

cat > /etc/nginx/sites-available/fjn-evolution <<EOF
server {
    listen 80;
    server_name ${EV_HOST};
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Habilita
ln -sf /etc/nginx/sites-available/fjn-atendimento /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/fjn-painel-api  /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/fjn-evolution   /etc/nginx/sites-enabled/

# Remove default
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "==> Emitindo certificados SSL via Certbot..."
certbot --nginx --non-interactive --agree-tos --email "${EMAIL}" \
    -d "${WA_HOST}" -d "${API_HOST}" -d "${EV_HOST}" \
    --redirect

echo ""
echo "✅ HTTPS ativo nos 3 subdomínios:"
echo "   https://${WA_HOST}        → fjn-atendimento"
echo "   https://${API_HOST}        → fjn-painel-api"
echo "   https://${EV_HOST}         → evolution-api (manager)"
echo ""
echo "Atualize o frontend Vercel pra apontar pra https://${API_HOST}"
