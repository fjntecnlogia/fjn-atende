# FJN PAINEL — Centro de comando da FJN Tecnologia

Painel administrativo unificado para gerenciar **atendimento WhatsApp**, **leads**, **handoffs**, **produtos** e **configuração da IA** dos produtos FJN (STYLOGESTOR, GYMFLOW, FJN Dev).

Monorepo (Turborepo) com:
- **apps/api** — Backend Fastify + JWT (TypeScript) — porta `3100`
- **apps/web** — Painel Next.js 14 + Tailwind (tema navy/orange FJN) — porta `3000`
- **packages/shared** — Tipos compartilhados

> ⚠️ Este painel **compartilha o banco PostgreSQL** com o serviço `fjn-atendimento`. Suba ele primeiro.

---

## Arquitetura

```
┌────────────────────────────────────────────────────────────────┐
│                    INFRAESTRUTURA FJN                          │
│                                                                │
│  ┌──────────────┐    ┌──────────────────┐   ┌──────────────┐  │
│  │ Vercel       │    │ VPS                  │   │ UltraMsg    │ │
│  │ (Frontend)   │◀──▶│ ┌──────────────┐ │   │             │  │
│  │ painel.fjn   │    │ │ fjn-painel-api│ │   │             │  │
│  │ tecnologia   │    │ │  :3100        │ │   │             │  │
│  └──────────────┘    │ └──────┬───────┘ │   │             │  │
│                      │        │         │   │             │  │
│                      │        ▼         │   │             │  │
│                      │ ┌──────────────┐ │   │             │  │
│                      │ │ Postgres :5432│ │   │             │  │
│                      │ └──────▲───────┘ │   │             │  │
│                      │        │         │   │             │  │
│                      │ ┌──────┴───────┐ │   │             │  │
│                      │ │ fjn-atendi-  │◀│──▶│             │  │
│                      │ │  mento :3000 │ │   │             │  │
│                      │ └──────────────┘ │   │             │  │
│                      └──────────────────┘   └──────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Setup local

```bash
# 1. Garanta que fjn-atendimento e o Postgres já estão rodando
cd "../fjn-atendimento"
docker compose up -d
npm install && npm run dev   # opcional — para testar fluxo completo

# 2. Vir pra cá
cd "../fjn-painel"
npm install                  # instala tudo do monorepo
```

### Backend (apps/api)

```bash
cd apps/api
cp .env.example .env
# preencha: DATABASE_URL (mesmo do fjn-atendimento), JWT_SECRET, ULTRAMSG_*

# Cria primeiro usuário admin (owner) e aplica o schema-admin.sql
npm run seed -- voce@fjntecnologia.com.br "Seu Nome" SuaSenhaForte

# Sobe a API
npm run dev
# API em http://localhost:3100
```

### Frontend (apps/web)

Em outro terminal:

```bash
cd apps/web
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3100

npm run dev
# Painel em http://localhost:3000
```

Faça login com o e-mail/senha criados no seed. 🚀

---

## Funcionalidades

### 📊 Dashboard
- KPIs em tempo real: conversas (24h), ativas, leads, handoffs pendentes
- Gráfico de mensagens por hora
- Distribuição de conversas por produto
- Contagem total de contatos

### 💬 Conversas
- Lista lateral com busca, filtros (todas/ativas/pausadas) e contador de não-lidas
- Thread completa com bolhas estilizadas (cliente / IA / humano)
- **Pausar bot** ou **reativar bot** com um clique
- **Enviar mensagem manual** — assume a conversa e pausa o bot por 60 min
- **Notas internas** por conversa (visíveis só pra equipe)
- Auto-refresh a cada 5-10s

### 👥 Leads
- Lista por produto e estágio (novo → qualificado → negociando → ganho/perdido)
- Atualização inline do estágio
- Filtro por produto

### ⚠️ Handoffs
- Fila de handoffs pendentes (com motivo e última mensagem do cliente)
- **Assumir** e **Resolver** com um clique
- Filtros: pendentes / em andamento / resolvidos / todos
- Atalho para abrir conversa correspondente

### 📦 Produtos
- Visão geral do portfólio FJN (STYLOGESTOR / GYMFLOW / FJN Dev)
- Status de cada produto

### ⚙️ Config IA
- Editor live dos arquivos que controlam a IA:
  - `system-master.md` — personalidade da Ana e regras
  - `*.knowledge.md` — dossiês de cada produto
- Backup automático antes de gravar
- Detecta alterações não salvas

---

## Deploy

### Backend (apps/api) → VPS

```bash
# Na VPS — ao lado do /opt/fjn-atendimento
git clone <repo> /opt/fjn-painel
cd /opt/fjn-painel
npm ci
npm --workspace @fjn-painel/shared run type-check   # garante tipos
cd apps/api
cp .env.example .env
nano .env   # preencha tudo (DATABASE_URL deve apontar pro mesmo Postgres)

# Cria seu admin
npm run seed -- voce@fjn.com.br "Seu Nome" SenhaForte

# Build + start com PM2
npm run build
pm2 start dist/server.js --name fjn-painel-api
pm2 save
```

Nginx (`/etc/nginx/sites-available/fjn-painel-api`):

```nginx
server {
    listen 80;
    server_name api-painel.fjntecnologia.com.br;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fjn-painel-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api-painel.fjntecnologia.com.br
```

### Frontend (apps/web) → Vercel

1. Faça push do monorepo no GitHub.
2. Em https://vercel.com → **New Project** → selecione o repo.
3. **Root directory:** `apps/web`
4. **Build command:** `cd ../.. && npm install && npm --workspace @fjn-painel/web run build`
5. **Output:** `.next`
6. Environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://api-painel.fjntecnologia.com.br
   ```
7. Domínio custom: `painel.fjntecnologia.com.br`.

---

## Estrutura

```
fjn-painel/
├── apps/
│   ├── api/                     # Backend Fastify
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── config.ts
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   └── schema-admin.sql
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts
│   │   │   │   └── ultramsg.ts
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── dashboard/
│   │   │       ├── conversations/
│   │   │       ├── leads/
│   │   │       ├── handoffs/
│   │   │       └── config/
│   │   └── scripts/seed-admin.ts
│   │
│   └── web/                     # Frontend Next.js 14
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── providers.tsx
│       │   ├── globals.css
│       │   ├── login/
│       │   └── (painel)/        # rotas autenticadas
│       │       ├── layout.tsx
│       │       ├── dashboard/
│       │       ├── conversas/
│       │       │   ├── page.tsx
│       │       │   └── _components/
│       │       ├── leads/
│       │       ├── handoffs/
│       │       ├── produtos/
│       │       └── config/
│       ├── components/
│       │   ├── ui/              # Badge, KpiCard
│       │   └── layout/Sidebar.tsx
│       ├── lib/
│       │   ├── api.ts           # axios + auth interceptor
│       │   ├── auth.ts          # Zustand store
│       │   └── utils.ts
│       ├── tailwind.config.ts   # tema FJN (navy + orange)
│       └── next.config.js
│
├── packages/
│   └── shared/                  # Tipos TS compartilhados
│       └── src/index.ts
│
├── turbo.json
├── package.json
└── README.md
```

---

## Próximos passos sugeridos

- [ ] WebSocket para notificações em tempo real (sino piscando quando chega handoff)
- [ ] Página de Usuários (criar outros operadores)
- [ ] Relatórios e exportação CSV
- [ ] Integração com calendar/CRM externo
- [ ] Histórico de versões/diff no editor de prompts
- [ ] Suporte a transcrição de áudio (cliente manda áudio → painel mostra texto)
