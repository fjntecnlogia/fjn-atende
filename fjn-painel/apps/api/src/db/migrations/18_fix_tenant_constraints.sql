-- =====================================================================
-- Fix constraints tenant pra bater com código atual
-- =====================================================================
-- O signup insere plan='none' e status='pending_payment'. As constraints
-- originais (do 03_multitenant.sql) não aceitavam esses valores, quebrando
-- o /auth/signup com erro 500.
--
-- Este fix já foi aplicado ad-hoc no banco em 04/08/2026. Migration serve
-- pra: (a) refletir o estado real do banco no repo e (b) reproduzir em
-- ambientes limpos (dev, staging, novo cliente).

-- Drop das constraints antigas (se existirem — IF EXISTS pra ser idempotente)
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;

-- Adiciona constraints alinhadas com o código
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('none', 'trial', 'starter', 'pro', 'enterprise'));

ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'pending_payment', 'past_due', 'suspended', 'canceled'));

-- Documenta valores esperados nas colunas
COMMENT ON COLUMN tenants.plan IS
  'Plano legado (deprecated pra assinantes). Valores: none|trial|starter|pro|enterprise.
   Cliente pagante real usa tenant_subscriptions.plan_id (Stripe). Este campo fica pra
   compat com tenants antigos + super_admin/FJN (sem subscription).';

COMMENT ON COLUMN tenants.status IS
  'Status geral do tenant. active=OK, pending_payment=criou conta mas nao pagou,
   past_due=cobrança falhou, suspended=admin bloqueou, canceled=fim de linha.
   Middleware requireActiveTenant bloqueia se != active.';
