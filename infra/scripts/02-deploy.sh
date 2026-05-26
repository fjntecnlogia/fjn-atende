#!/usr/bin/env bash
# =====================================================================
# Deploy / atualização dos serviços FJN na VPS
# Roda como usuário não-root 'fjn' depois do bootstrap.
#
# Pressupõe:
#   - /opt/fjn contém o repositório (atendimento + painel + infra)
#   - /opt/fjn/infra/.env preenchido
#   - /opt/fjn/fjn-atendimento/.env preenchido
#   - /opt/fjn/fjn-painel/apps/api/.env preenchido
#
# Uso:
#   cd /opt/fjn && ./infra/scripts/02-deploy.sh
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")/../.."   # vai pra /opt/fjn

echo "==> Verificando .env's necessários..."
required_envs=(
    "infra/.env"
    "fjn-atendimento/.env"
    "fjn-painel/apps/api/.env"
)
for f in "${required_envs[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo "❌ Falta arquivo: $f"
        echo "   Copie do .env.example e preencha antes de continuar."
        exit 1
    fi
done

echo "==> Atualizando código do repositório (git pull)..."
git pull --ff-only || echo "  (sem git, pulando)"

echo "==> Construindo imagens..."
cd infra
docker compose build

echo "==> Subindo serviços..."
docker compose up -d

echo "==> Aguardando healthchecks..."
sleep 8
docker compose ps

cat <<EOF

═══════════════════════════════════════════════════════════════════════
✅ Deploy concluído!

Serviços rodando:
  - Postgres:           porta 5432 (interno)
  - Redis:              porta 6379 (interno)
  - Evolution API:      127.0.0.1:8080
  - fjn-atendimento:    127.0.0.1:3001
  - fjn-painel-api:     127.0.0.1:3100

Próximos passos:
  1. Configurar Nginx + HTTPS:  ./infra/scripts/03-nginx-ssl.sh
  2. Conectar instância WhatsApp:  abra https://evolution.SEU_DOMINIO/manager
═══════════════════════════════════════════════════════════════════════
EOF
