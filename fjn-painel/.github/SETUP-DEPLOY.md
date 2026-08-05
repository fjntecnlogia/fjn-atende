# Setup do auto-deploy VPS

Workflow: `.github/workflows/deploy-vps.yml`

Toda vez que você faz push na `main`, o GitHub Actions:
1. Detecta se mudou algo em `apps/api/**` ou `packages/**` (se só mudou `apps/web/**`, ignora — Vercel cuida)
2. Conecta SSH na VPS
3. Faz `git pull`, `docker compose build` e `up -d --force-recreate` do container `fjn-painel-api`
4. Detecta migrations novas em `apps/api/src/db/migrations/` e aplica no Postgres `atende_pg` automaticamente
5. Reporta sucesso/falha na aba **Actions** do GitHub

## Setup inicial (5 min — faz UMA VEZ)

### 1. Cria uma chave SSH dedicada pro deploy (na sua máquina local)

Nunca use sua chave SSH pessoal — cria uma exclusiva pro CI:

```bash
ssh-keygen -t ed25519 -C "github-actions@fjn-atende" -f ~/.ssh/fjn_atende_deploy -N ""
```

Gera 2 arquivos:
- `~/.ssh/fjn_atende_deploy`     (privada — vai pro GitHub Secret)
- `~/.ssh/fjn_atende_deploy.pub` (pública — vai pra VPS)

### 2. Autoriza a chave pública na VPS

Copia a pública pra `authorized_keys` do usuário root:

```bash
cat ~/.ssh/fjn_atende_deploy.pub | ssh root@2.25.134.70 "cat >> ~/.ssh/authorized_keys"
```

Ou pega o conteúdo e cola manual:

```bash
cat ~/.ssh/fjn_atende_deploy.pub
# copia o output

ssh root@2.25.134.70
nano ~/.ssh/authorized_keys
# cola no fim + Ctrl+O + Ctrl+X
```

Testa que funciona sem senha:

```bash
ssh -i ~/.ssh/fjn_atende_deploy root@2.25.134.70 "echo OK"
# deve responder OK
```

### 3. Cadastra os 3 secrets no GitHub

Vai em https://github.com/fjntecnlogia/fjn-atende/settings/secrets/actions e clica **New repository secret** pra cada um:

| Nome | Valor |
|---|---|
| `VPS_HOST` | `2.25.134.70` |
| `VPS_USER` | `root` (ou o usuário que você usa via SSH) |
| `VPS_SSH_KEY` | conteúdo COMPLETO de `~/.ssh/fjn_atende_deploy` (inclui `-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`) |

Opcional (só se sua VPS usa porta SSH customizada, tipo 2222):

| `VPS_SSH_PORT` | `2222` |

### 4. Pronto — testa disparo manual

Vai em https://github.com/fjntecnlogia/fjn-atende/actions/workflows/deploy-vps.yml → botão **Run workflow** → escolhe branch `main` → **Run workflow**.

Ele dispara. Clica no run pra ver logs em tempo real. Se tudo verde ✅, tá funcionando.

## Como usar no dia a dia

Nada. Só faz commit + push normal — o deploy é automático.

```bash
git add .
git commit -m "feat: nova feature"
git push origin main
```

Em ~2 minutos:
- ✅ Vercel deploya frontend (auto)
- ✅ GitHub Actions faz pull na VPS, rebuilda backend, aplica migrations novas

Confere status na aba **Actions** do repo ou pelo próprio GitHub (badge de commit fica verde/vermelho).

## O que fazer se der erro no deploy

1. Abre o commit no GitHub — se tem ❌, clica pra ver logs
2. Erros comuns:
   - **SSH refuses connection** → chave pública não foi adicionada na VPS certa. Testa `ssh -i ~/.ssh/fjn_atende_deploy root@IP`
   - **docker compose not found** → PATH da VPS não tem docker no shell não-interativo. Adicionar `export PATH=/usr/local/bin:$PATH` no `~/.bashrc` da VPS
   - **git pull conflict** → alguém mexeu manualmente no `/opt/fjn/fjn-painel`. Conecta SSH e `git status` pra resolver
   - **migration error** → SQL da migration tem erro. Corrige localmente, commita, dispara de novo

## Como voltar pra deploy manual (rollback do workflow)

Se quiser desativar temporariamente:

```
GitHub → Actions → Deploy VPS → botão "..." → Disable workflow
```

Reativa quando quiser sem perder o arquivo.

## Segurança

- ✅ Chave SSH dedicada (só serve pra deploy — se comprometida, revoga sem afetar sua chave pessoal)
- ✅ Secret armazenado criptografado no GitHub (não aparece em log)
- ✅ Workflow só roda em push na `main` (PRs não têm acesso aos secrets)
- ⚠️ Se algum dia mudar user/porta SSH da VPS, atualiza o secret correspondente
