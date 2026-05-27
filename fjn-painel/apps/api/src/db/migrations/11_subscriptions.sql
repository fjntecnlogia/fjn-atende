-- =====================================================================
-- PLANOS RECORRENTES — Stripe Subscriptions
-- =====================================================================
-- Modelo: pago-pra-usar (sem trial). Pro / Pro+ mensal ou anual com 20% off.
-- Hard limits: excedeu cota, sistema cobra do crédito pré-pago.
-- Falha de pagamento = bloqueio imediato (status='past_due').

-- =====================================================================
-- 1. SUBSCRIPTION_PLANS — catálogo de planos
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                       SERIAL PRIMARY KEY,
  slug                     VARCHAR(40) NOT NULL UNIQUE,    -- 'pro_monthly', 'pro_annual', etc
  name                     VARCHAR(60) NOT NULL,           -- 'Pro Mensal'
  tier                     VARCHAR(20) NOT NULL,           -- 'pro' | 'pro_plus'
  billing_cycle            VARCHAR(20) NOT NULL,           -- 'monthly' | 'annual'
  price_cents              INTEGER NOT NULL,               -- preço total do ciclo (anual = 12× já com desconto)
  stripe_price_id          VARCHAR(120),                   -- price_xxx do Stripe (popular depois)
  -- Limites estruturais (hard):
  max_instances            INTEGER NOT NULL DEFAULT 1,     -- nº de instâncias WhatsApp
  max_users                INTEGER NOT NULL DEFAULT 3,     -- nº de usuários no tenant
  max_pipelines            INTEGER NOT NULL DEFAULT 1,     -- 1 (Pro) / ilimitado (Pro+)
  max_teams                INTEGER NOT NULL DEFAULT 0,     -- Pro+ pode criar times
  -- Limites de uso (hard, com excedente cobrado do crédito):
  included_ai_messages     INTEGER NOT NULL DEFAULT 1000,  -- msgs IA incluídas no mês
  included_campaign_msgs   INTEGER NOT NULL DEFAULT 1000,  -- msgs de campanha incluídas
  -- Features booleanas:
  features                 JSONB NOT NULL DEFAULT '{}',
                            -- {"multipipeline": true, "white_label": false,
                            --  "advanced_metrics": true, "api_access": true,
                            --  "custom_branding": false, "priority_support": true}
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plans_tier ON subscription_plans(tier);

-- =====================================================================
-- 2. TENANT_SUBSCRIPTIONS — assinatura ativa de cada tenant
-- =====================================================================
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                       SERIAL PRIMARY KEY,
  tenant_id                INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                  INTEGER NOT NULL REFERENCES subscription_plans(id),
  -- Stripe IDs:
  stripe_customer_id       VARCHAR(120),
  stripe_subscription_id   VARCHAR(120) UNIQUE,
  stripe_price_id          VARCHAR(120),
  -- Status:
  status                   VARCHAR(40) NOT NULL DEFAULT 'incomplete',
                            -- 'incomplete'  = checkout iniciado, ainda não pagou
                            -- 'active'      = pago e em dia
                            -- 'past_due'    = cobrança falhou (bloqueado)
                            -- 'canceled'    = cancelado, fim do período
                            -- 'unpaid'      = vários ciclos sem pagar
  -- Períodos:
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at              TIMESTAMPTZ,
  -- Uso do ciclo atual (resetado em current_period_start):
  ai_messages_used         INTEGER NOT NULL DEFAULT 0,
  campaign_msgs_used       INTEGER NOT NULL DEFAULT 0,
  -- Metadata:
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)  -- um tenant tem só uma subscription ativa
);
CREATE INDEX IF NOT EXISTS idx_subs_status     ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_period_end ON tenant_subscriptions(current_period_end)
  WHERE status IN ('active', 'past_due');

-- =====================================================================
-- 3. SUBSCRIPTION_EVENTS — audit trail (mudanças de plano, cancel, etc)
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id     INTEGER REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
  event_type          VARCHAR(50) NOT NULL,
                       -- 'created', 'plan_changed', 'canceled', 'reactivated',
                       -- 'payment_succeeded', 'payment_failed',
                       -- 'past_due', 'recovered'
  from_plan_id        INTEGER REFERENCES subscription_plans(id),
  to_plan_id          INTEGER REFERENCES subscription_plans(id),
  stripe_event_id     VARCHAR(120),
  amount_cents        INTEGER,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_events_tenant ON subscription_events(tenant_id, created_at DESC);

-- =====================================================================
-- 4. SEED — planos Pro e Pro+ (mensal + anual)
-- =====================================================================
INSERT INTO subscription_plans
  (slug, name, tier, billing_cycle, price_cents,
   max_instances, max_users, max_pipelines, max_teams,
   included_ai_messages, included_campaign_msgs, features, sort_order)
VALUES
  -- Pro Mensal: R$ 99 → 9900 cents
  ('pro_monthly',
   'Pro Mensal',
   'pro', 'monthly', 9900,
   1, 3, 1, 0,
   1000, 1000,
   '{"multipipeline": false, "advanced_metrics": false, "api_access": false,
     "custom_branding": false, "priority_support": false, "white_label": false}'::jsonb,
   1),

  -- Pro Anual: R$ 950 (=R$ 79,16/mês, 20% off)
  ('pro_annual',
   'Pro Anual (20% off)',
   'pro', 'annual', 95000,
   1, 3, 1, 0,
   1000, 1000,
   '{"multipipeline": false, "advanced_metrics": false, "api_access": false,
     "custom_branding": false, "priority_support": false, "white_label": false}'::jsonb,
   2),

  -- Pro+ Mensal: R$ 299 → 29900 cents
  ('pro_plus_monthly',
   'Pro+ Mensal',
   'pro_plus', 'monthly', 29900,
   3, 10, 99, 99,  -- ilimitado prático
   5000, 5000,
   '{"multipipeline": true, "advanced_metrics": true, "api_access": true,
     "custom_branding": true, "priority_support": true, "white_label": false}'::jsonb,
   3),

  -- Pro+ Anual: R$ 2870 (=R$ 239,16/mês, 20% off)
  ('pro_plus_annual',
   'Pro+ Anual (20% off)',
   'pro_plus', 'annual', 287000,
   3, 10, 99, 99,
   5000, 5000,
   '{"multipipeline": true, "advanced_metrics": true, "api_access": true,
     "custom_branding": true, "priority_support": true, "white_label": false}'::jsonb,
   4)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- 5. FUNÇÃO — verifica se tenant pode usar uma feature
-- =====================================================================
CREATE OR REPLACE FUNCTION tenant_can_use(p_tenant_id INTEGER, p_feature TEXT)
  RETURNS BOOLEAN AS $$
DECLARE
  v_status   VARCHAR(40);
  v_features JSONB;
BEGIN
  -- Tenant super-admin (sem subscription) sempre pode tudo
  SELECT s.status, p.features INTO v_status, v_features
    FROM tenant_subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id
   WHERE s.tenant_id = p_tenant_id
   LIMIT 1;

  -- Sem subscription = bloqueado (pending_payment)
  IF v_status IS NULL THEN RETURN FALSE; END IF;

  -- Bloqueado se não está active
  IF v_status NOT IN ('active') THEN RETURN FALSE; END IF;

  -- Tem a feature?
  RETURN COALESCE((v_features->>p_feature)::boolean, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 6. FUNÇÃO — verifica/incrementa cota de mensagens
--    Retorna TRUE se pode consumir (cota disponível ou crédito disponível)
-- =====================================================================
CREATE OR REPLACE FUNCTION tenant_consume_ai_message(p_tenant_id INTEGER)
  RETURNS BOOLEAN AS $$
DECLARE
  v_sub_id     INTEGER;
  v_used       INTEGER;
  v_included   INTEGER;
  v_status     VARCHAR(40);
BEGIN
  SELECT s.id, s.ai_messages_used, p.included_ai_messages, s.status
    INTO v_sub_id, v_used, v_included, v_status
    FROM tenant_subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id
   WHERE s.tenant_id = p_tenant_id;

  -- Sem subscription = bloqueia
  IF v_sub_id IS NULL THEN RETURN FALSE; END IF;
  IF v_status NOT IN ('active') THEN RETURN FALSE; END IF;

  -- Dentro da cota: incrementa e libera
  IF v_used < v_included THEN
    UPDATE tenant_subscriptions
       SET ai_messages_used = ai_messages_used + 1, updated_at = NOW()
     WHERE id = v_sub_id;
    RETURN TRUE;
  END IF;

  -- Excedeu: tenta debitar do crédito pré-pago (R$ 0,03 por msg = 3 cents)
  -- (debit_credits retorna FALSE se sem saldo)
  RETURN (SELECT debit_credits(p_tenant_id, 3, 'ai_overage', 'IA: msg excedente do plano', NULL, NULL));
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 7. View resumo de subscription pro painel
-- =====================================================================
CREATE OR REPLACE VIEW tenant_subscription_summary AS
SELECT
  s.tenant_id,
  s.status,
  p.slug              AS plan_slug,
  p.name              AS plan_name,
  p.tier              AS plan_tier,
  p.billing_cycle,
  p.price_cents,
  p.max_instances, p.max_users, p.max_pipelines, p.max_teams,
  p.included_ai_messages, p.included_campaign_msgs,
  p.features,
  s.ai_messages_used,
  s.campaign_msgs_used,
  GREATEST(p.included_ai_messages - s.ai_messages_used, 0)         AS ai_messages_remaining,
  GREATEST(p.included_campaign_msgs - s.campaign_msgs_used, 0)     AS campaign_msgs_remaining,
  s.current_period_start, s.current_period_end,
  s.cancel_at_period_end, s.canceled_at,
  EXTRACT(DAY FROM (s.current_period_end - NOW()))::int            AS days_until_renewal
FROM tenant_subscriptions s
JOIN subscription_plans   p ON p.id = s.plan_id;
