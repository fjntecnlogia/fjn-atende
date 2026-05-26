# FJN Atendimento — WhatsApp Unificado

Sistema de atendimento WhatsApp humanizado para os produtos da **FJN Tecnologia**:
- **STYLOGESTOR** (SaaS para barbearias e salões)
- **GYMFLOW** (SaaS para academias)
- **FJN Desenvolvimento** (serviços de software sob demanda)

Stack: **Node.js + Fastify + TypeScript + PostgreSQL + Claude API (Sonnet 4.6) + UltraMsg**.

---

## Como funciona

```
Cliente → WhatsApp → UltraMsg → Webhook → Backend (Fastify)
                                              │
                                              ├─► Buffer (debounce 3s)
                                              ├─► Postgres (histórico)
                                              ├─► Claude API (com prompt caching)
                                              ├─► Humanizer (digitação simulada + quebra de msgs)
                                              └─► UltraMsg → WhatsApp do cliente
```

- **Prompt caching** ativado: o system prompt grande (com os 3 dossiês) é cacheado a cada chamada → economia de ~70-90% no custo.
- **Debounce**: se o cliente mandar 5 mensagens em 3 segundos, o bot espera e responde uma só vez (parece mais natural).
- **Humanização**: simula digitação, quebra resposta em mensagens menores, jitter aleatório.
- **Handoff**: detecta automaticamente quando passar para humano (cancelamento, reclamação, dúvida fora do escopo) e te notifica no seu próprio WhatsApp.

---

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose (para o Postgres)
- Conta UltraMsg ativa
- API key da Anthropic (https://console.anthropic.com/)
- Uma VPS Linux (Ubuntu 22.04+) **OU** ambiente local para testes

---

## Setup local (desenvolvimento)

```bash
# 1. Clonar / entrar no projeto
cd "G:/Meu Drive/Controle de Clientes FJN/sistemas/fjn-atendimento"

# 2. Instalar dependências
npm install

# 3. Configurar variáveis
cp .env.example .env
# edite .env com suas chaves reais

# 4. Subir o Postgres
docker compose up -d
# o schema.sql é aplicado automaticamente na primeira inicialização

# 5. Rodar em modo desenvolvimento
npm run dev
```

O servidor sobe em `http://localhost:3000`.
Endpoint de healthcheck: `GET /healthz` → `{ ok: true }`.

---

## Configurar o webhook no UltraMsg

1. Acesse https://user.ultramsg.com/
2. Vá em sua instância → **Settings → Webhooks**
3. Em **Webhook URL** coloque:
   ```
   https://SEU-DOMINIO.com/webhook/ultramsg?token=SEU_TOKEN_DO_ENV
   ```
   (o token deve bater com `ULTRAMSG_WEBHOOK_TOKEN` do `.env`)
4. Marque **"Webhook on message received"** ✅
5. Salve.

> Para testar localmente sem deploy, use `ngrok http 3000` e use a URL pública gerada.

---

## Deploy na VPS

### 1. Preparar a VPS (Ubuntu 22.04)

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# PM2 global
sudo npm install -g pm2

# Nginx + Certbot (HTTPS)
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Subir o projeto

```bash
git clone <seu-repo> /opt/fjn-atendimento
cd /opt/fjn-atendimento

cp .env.example .env
nano .env   # preencha as chaves

docker compose up -d         # Postgres
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup                  # siga o comando que aparece
```

### 3. Nginx + HTTPS

`/etc/nginx/sites-available/fjn-atendimento`:

```nginx
server {
    listen 80;
    server_name atendimento.fjntecnologia.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fjn-atendimento /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d atendimento.fjntecnologia.com.br
```

Pronto — webhook agora respondendo em `https://atendimento.fjntecnologia.com.br/webhook/ultramsg`.

---

## Operação no dia a dia

### Comandos úteis

```bash
pm2 status                          # ver se está rodando
pm2 logs fjn-atendimento            # logs em tempo real
pm2 restart fjn-atendimento         # reiniciar após mudança
pm2 stop fjn-atendimento            # parar (cliente não recebe resposta automática)

docker compose logs -f postgres     # logs do banco
```

### Pausar o bot manualmente para um cliente

```sql
UPDATE conversations
   SET status = 'paused'
 WHERE contact_id = (SELECT id FROM contacts WHERE phone = '5511999999999');
```

### Reativar o bot

```sql
UPDATE conversations SET status = 'active', bot_paused_until = NULL
 WHERE contact_id = (SELECT id FROM contacts WHERE phone = '5511999999999');
```

### Ver últimas conversas

```sql
SELECT c.phone, c.name, m.role, m.content, m.sent_at
  FROM messages m
  JOIN conversations conv ON conv.id = m.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
 ORDER BY m.id DESC
 LIMIT 50;
```

---

## Customização

### Mudar o tom da Ana / regras de atendimento
Edite `src/prompts/system-master.md` e reinicie o serviço.

### Atualizar info de produto
Edite os arquivos em `src/products/*.knowledge.md` e reinicie. A IA passa a usar imediatamente.

### Adicionar um novo produto
1. Crie `src/products/novo-produto.knowledge.md`
2. Em `src/core/agent.ts` adicione mais uma linha em `productsKnowledge`:
   ```ts
   readKnowledge("novo-produto.knowledge.md", "PRODUTO 4 — NOVO")
   ```
3. Build + restart.

### Mudar velocidade de "digitação"
Ajuste `TYPING_CHARS_PER_SEC` no `.env`.

### Mudar tempo de debounce
Ajuste `DEBOUNCE_MS` no `.env`.

---

## Custos estimados (mês)

| Item | Valor |
|------|-------|
| VPS (Hostinger / Contabo, 2GB RAM) | R$ 30–50 |
| UltraMsg | já pago |
| Claude API (~500 conversas/mês, com cache) | R$ 30–120 |
| Domínio + SSL (Certbot grátis) | R$ 5 |
| **Total** | **R$ 65–175 / mês** |

---

## Roadmap próximo

- [ ] Painel web simples para ver conversas e assumir handoffs
- [ ] Suporte a mensagens de áudio (transcrição + resposta)
- [ ] Suporte a imagens (cliente manda foto → IA analisa)
- [ ] Captura automática de leads → CRM/planilha
- [ ] Métricas: taxa de resolução, tempo médio, taxa de handoff
