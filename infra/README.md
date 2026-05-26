# FJN Infraestrutura

Tudo que roda na VPS Hostinger numa pasta só.

## Conteúdo

```
infra/
├── docker-compose.yml          # Orquestra postgres + redis + evolution + atendimento + painel-api
├── Dockerfile.atendimento      # Build do fjn-atendimento
├── Dockerfile.painel-api       # Build do fjn-painel-api
├── .env.example                # Vars do compose
├── nginx/                      # (vazio — configs geradas pelo script 03)
└── scripts/
    ├── 01-bootstrap.sh         # Setup inicial da VPS (1x)
    ├── 02-deploy.sh             # Deploy/atualização dos serviços
    └── 03-nginx-ssl.sh          # Nginx + HTTPS Certbot
```

## Roteiro completo

### Pré-requisitos
- VPS Ubuntu 22.04 ou 24.04
- Domínio próprio com DNS configurável
- 3 subdomínios apontando pro IP da VPS:
  - `wa.SEUDOMINIO.com.br` (webhook do atendimento)
  - `api-painel.SEUDOMINIO.com.br` (API do painel)
  - `evolution.SEUDOMINIO.com.br` (manager do Evolution)

### Passo 1 — Bootstrap (1x)
```bash
ssh root@SEU_IP
wget https://raw.githubusercontent.com/<seu-repo>/main/infra/scripts/01-bootstrap.sh
chmod +x 01-bootstrap.sh
./01-bootstrap.sh
```

### Passo 2 — Clonar repo e configurar
```bash
ssh fjn@SEU_IP    # usuário criado pelo bootstrap
cd /opt/fjn
git clone <seu-repo> .

# Preenche os 3 .env's
cp infra/.env.example infra/.env && nano infra/.env
cp fjn-atendimento/.env.example fjn-atendimento/.env && nano fjn-atendimento/.env
cp fjn-painel/apps/api/.env.example fjn-painel/apps/api/.env && nano fjn-painel/apps/api/.env
```

### Passo 3 — Subir tudo
```bash
./infra/scripts/02-deploy.sh
```

### Passo 4 — HTTPS
```bash
sudo DOMAIN=fjntecnologia.com.br EMAIL=fjntecnologia2022@gmail.com \
    ./infra/scripts/03-nginx-ssl.sh
```

### Passo 5 — Criar instância WhatsApp
1. Acesse `https://evolution.SEUDOMINIO.com.br/manager`
2. Login com a `EVOLUTION_API_KEY` que está no `.env`
3. **Create Instance** → nome: `fjn-atendimento`
4. **Connect** → escaneie QR code com WhatsApp Business do chip novo
5. Pronto!

### Passo 6 — Deploy frontend
Frontend Vercel (separado, fora desta VPS):
- Push do repo `fjn-painel` no GitHub
- Vercel conecta no repo → root directory `apps/web`
- Env: `NEXT_PUBLIC_API_URL=https://api-painel.SEUDOMINIO.com.br`

## Comandos úteis

```bash
# Status dos serviços
docker compose -f infra/docker-compose.yml ps

# Logs em tempo real
docker compose -f infra/docker-compose.yml logs -f fjn-atendimento

# Reiniciar um serviço
docker compose -f infra/docker-compose.yml restart fjn-atendimento

# Parar tudo
docker compose -f infra/docker-compose.yml down

# Backup do Postgres
docker exec fjn_postgres pg_dump -U fjn fjn_atendimento > backup-$(date +%F).sql

# Atualizar código + redeploy
cd /opt/fjn && git pull && ./infra/scripts/02-deploy.sh
```
