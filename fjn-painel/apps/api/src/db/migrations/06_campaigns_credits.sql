-- =====================================================================
-- Sistema de créditos pré-pagos pra Campanhas (pay-per-use)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Saldo de créditos por tenant (em centavos pra evitar float)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_credits (
  tenant_id        INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance_cents    BIGINT NOT NULL DEFAULT 0,
  total_purchased_cents BIGINT NOT NULL DEFAULT 0,
  total_spent_cents     BIGINT NOT NULL DEFAULT 0,
  auto_recharge        BOOLEAN NOT NULL DEFAULT FALSE,
  auto_recharge_threshold_cents BIGINT DEFAULT 1000,   -- R$ 10
  auto_recharge_amount_cents    BIGINT DEFAULT 5000,   -- R$ 50
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Histórico de transações de créditos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_transactions (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- "purchase" = comprou crédito (+amount_cents)
  -- "debit" = enviou mensagem (-amount_cents)
  -- "refund" = devolveu (+amount_cents)
  -- "bonus" = bônus FJN/promoção (+amount_cents)
  -- "manual" = ajuste manual super-admin
  kind           VARCHAR(20) NOT NULL CHECK (kind IN ('purchase','debit','refund','bonus','manual')),
  amount_cents   BIGINT NOT NULL,            -- pode ser negativo pra débito
  balance_after_cents BIGINT NOT NULL,        -- saldo após transação
  description    TEXT,
  -- Vínculo opcional com campanha (pra débitos de mensagens)
  campaign_id    INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  recipient_id   BIGINT  REFERENCES campaign_recipients(id) ON DELETE SET NULL,
  -- Vínculo opcional com pagamento externo
  payment_provider     VARCHAR(40),           -- "pagarme", "stripe", "manual"
  payment_external_id  VARCHAR(120),
  -- Auditoria
  created_by     INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_tenant   ON credit_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_campaign ON credit_transactions(campaign_id) WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Tabela de tarifas (preço por mensagem por provider)
-- Pode ter override por tenant (Enterprise negociado)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_pricing (
  id              SERIAL PRIMARY KEY,
  -- NULL = global (default pra todos tenants); >0 = override pra tenant específico
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  provider        VARCHAR(20) NOT NULL CHECK (provider IN ('wppconnect','meta_cloud','evolution','ultramsg')),
  price_cents     INTEGER NOT NULL,
  -- Validade (opcional, pra promoções)
  valid_from      TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- Seed dos preços padrão
INSERT INTO message_pricing (tenant_id, provider, price_cents)
SELECT NULL, 'wppconnect', 3   -- R$ 0,03
WHERE NOT EXISTS (SELECT 1 FROM message_pricing WHERE tenant_id IS NULL AND provider = 'wppconnect');

INSERT INTO message_pricing (tenant_id, provider, price_cents)
SELECT NULL, 'meta_cloud', 15  -- R$ 0,15
WHERE NOT EXISTS (SELECT 1 FROM message_pricing WHERE tenant_id IS NULL AND provider = 'meta_cloud');

INSERT INTO message_pricing (tenant_id, provider, price_cents)
SELECT NULL, 'evolution', 3
WHERE NOT EXISTS (SELECT 1 FROM message_pricing WHERE tenant_id IS NULL AND provider = 'evolution');

INSERT INTO message_pricing (tenant_id, provider, price_cents)
SELECT NULL, 'ultramsg', 5
WHERE NOT EXISTS (SELECT 1 FROM message_pricing WHERE tenant_id IS NULL AND provider = 'ultramsg');

-- ---------------------------------------------------------------------
-- Atualiza limites: campanhas só Pro+ (Starter perde acesso)
-- ---------------------------------------------------------------------
UPDATE plans SET allow_campaigns = (slug IN ('pro','enterprise'));

-- ---------------------------------------------------------------------
-- Função helper: debitar saldo (transactional + atualiza saldo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION debit_credits(
  p_tenant_id INTEGER,
  p_amount_cents BIGINT,
  p_description TEXT,
  p_campaign_id INTEGER DEFAULT NULL,
  p_recipient_id BIGINT DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, balance_after BIGINT) AS $$
DECLARE
  v_current BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- Garante row em tenant_credits
  INSERT INTO tenant_credits (tenant_id) VALUES (p_tenant_id) ON CONFLICT DO NOTHING;

  -- Lock row
  SELECT balance_cents INTO v_current
  FROM tenant_credits WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF v_current < p_amount_cents THEN
    RETURN QUERY SELECT FALSE, v_current;
    RETURN;
  END IF;

  v_new_balance := v_current - p_amount_cents;

  UPDATE tenant_credits
     SET balance_cents = v_new_balance,
         total_spent_cents = total_spent_cents + p_amount_cents,
         updated_at = NOW()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO credit_transactions
    (tenant_id, kind, amount_cents, balance_after_cents, description, campaign_id, recipient_id)
  VALUES
    (p_tenant_id, 'debit', -p_amount_cents, v_new_balance, p_description, p_campaign_id, p_recipient_id);

  RETURN QUERY SELECT TRUE, v_new_balance;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Função helper: creditar saldo (compra, bônus, refund)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_credits(
  p_tenant_id INTEGER,
  p_amount_cents BIGINT,
  p_kind VARCHAR(20),
  p_description TEXT,
  p_payment_provider VARCHAR(40) DEFAULT NULL,
  p_payment_external_id VARCHAR(120) DEFAULT NULL,
  p_admin_user_id INTEGER DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  INSERT INTO tenant_credits (tenant_id) VALUES (p_tenant_id) ON CONFLICT DO NOTHING;

  UPDATE tenant_credits
     SET balance_cents = balance_cents + p_amount_cents,
         total_purchased_cents = total_purchased_cents +
           (CASE WHEN p_kind = 'purchase' THEN p_amount_cents ELSE 0 END),
         updated_at = NOW()
   WHERE tenant_id = p_tenant_id
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO credit_transactions
    (tenant_id, kind, amount_cents, balance_after_cents, description,
     payment_provider, payment_external_id, created_by)
  VALUES
    (p_tenant_id, p_kind, p_amount_cents, v_new_balance, p_description,
     p_payment_provider, p_payment_external_id, p_admin_user_id);

  RETURN v_new_balance;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Bônus inicial pra novos tenants (R$ 5,00 = 100-150 msgs)
-- ---------------------------------------------------------------------
-- Aplica retroativamente pro FJN (tenant #1) — só pra testes
INSERT INTO tenant_credits (tenant_id, balance_cents, total_purchased_cents)
VALUES (1, 500, 500)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO credit_transactions (tenant_id, kind, amount_cents, balance_after_cents, description)
SELECT 1, 'bonus', 500, 500, 'Bônus inicial FJN (testes)'
WHERE NOT EXISTS (SELECT 1 FROM credit_transactions WHERE tenant_id = 1);
