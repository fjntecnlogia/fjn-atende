#!/usr/bin/env bash
# =====================================================================
# Bootstrap inicial da VPS Ubuntu 22.04 / 24.04
# Roda 1 vez como root, logo após contratar a VPS.
#
# Instala: Docker, Docker Compose, Nginx, Certbot, fail2ban, UFW.
# Configura: firewall, usuário não-root, SSH hardening.
#
# Uso:
#   ssh root@SEU_IP
#   curl -fsSL https://raw.githubusercontent.com/.../01-bootstrap.sh | bash
#   # OU
#   wget <url> && chmod +x 01-bootstrap.sh && ./01-bootstrap.sh
# =====================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Erro: rode este script como root." >&2
    exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-fjn}"

echo "==> [1/8] Atualizando sistema..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo "==> [2/8] Instalando pacotes base..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl wget gnupg2 ca-certificates lsb-release \
    ufw fail2ban htop git unzip \
    nginx certbot python3-certbot-nginx

echo "==> [3/8] Instalando Docker..."
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> [4/8] Configurando firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Nginx + Certbot)'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "==> [5/8] Criando usuário não-root '${DEPLOY_USER}'..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
    mkdir -p /home/"$DEPLOY_USER"/.ssh
    chmod 700 /home/"$DEPLOY_USER"/.ssh

    # Copia a authorized_keys do root pro novo usuário (mesmo acesso SSH)
    if [[ -f /root/.ssh/authorized_keys ]]; then
        cp /root/.ssh/authorized_keys /home/"$DEPLOY_USER"/.ssh/authorized_keys
        chown -R "$DEPLOY_USER":"$DEPLOY_USER" /home/"$DEPLOY_USER"/.ssh
        chmod 600 /home/"$DEPLOY_USER"/.ssh/authorized_keys
    fi
fi

echo "==> [6/8] SSH: habilitando PubkeyAuthentication (não desabilita senha ainda)..."
SSHD_CONFIG=/etc/ssh/sshd_config
# Só garante que chave SSH funciona. Senha continua ativa pra você não ficar
# fora. Depois que confirmar acesso por chave, rode: ./99-harden-ssh.sh
sed -i 's/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/' "$SSHD_CONFIG"
systemctl reload ssh || systemctl reload sshd

echo "==> [7/8] Iniciando fail2ban..."
systemctl enable --now fail2ban

echo "==> [8/8] Preparando diretórios FJN..."
mkdir -p /opt/fjn
chown "$DEPLOY_USER":"$DEPLOY_USER" /opt/fjn

cat <<EOF

═══════════════════════════════════════════════════════════════════════
✅ Bootstrap concluído!

PRÓXIMOS PASSOS:
  1. Saia do root (Ctrl+D ou 'exit')
  2. Conecte como '${DEPLOY_USER}':
        ssh ${DEPLOY_USER}@\$(hostname -I | awk '{print \$1}')
  3. Clone o repo: git clone <repo> /opt/fjn (ou rsync)
  4. Rode: cd /opt/fjn/infra && cp .env.example .env && nano .env
  5. Subir tudo: docker compose up -d

⚠️  PRÓXIMO PASSO DE SEGURANÇA:
    Depois que confirmar que consegue logar via SSH como '${DEPLOY_USER}',
    rode o script 99-harden-ssh.sh pra desabilitar login root e password auth.

═══════════════════════════════════════════════════════════════════════
EOF
