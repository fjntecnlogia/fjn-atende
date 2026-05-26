#!/usr/bin/env bash
# =====================================================================
# Hardening de SSH — desabilita login root e senha
#
# ⚠️ SÓ RODE DEPOIS DE:
#   1. Ter chave SSH no servidor (~/.ssh/authorized_keys)
#   2. Ter testado login pelo usuário não-root via chave (sem senha)
#
# Uso:
#   sudo ./99-harden-ssh.sh
# =====================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Erro: rode como root (sudo)." >&2
    exit 1
fi

SSHD_CONFIG=/etc/ssh/sshd_config

# Backup
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%s)"

# Desabilita root login
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' "$SSHD_CONFIG"
# Desabilita senha
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' "$SSHD_CONFIG"
# Garante chave pública
sed -i 's/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/' "$SSHD_CONFIG"

# Testa config antes de reload
if ! sshd -t; then
    echo "❌ sshd config tem erro. Restaurando backup..." >&2
    cp "${SSHD_CONFIG}.bak."* "$SSHD_CONFIG"
    exit 1
fi

systemctl reload ssh || systemctl reload sshd

echo "✅ SSH hardened. Login root e por senha DESABILITADOS."
echo "   Use sempre: ssh fjn@<ip>  (com chave SSH)"
