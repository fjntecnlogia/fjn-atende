-- =====================================================================
-- Stripe Checkout Sessions — tracking de pagamentos pendentes
-- =====================================================================

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- IDs do Stripe
  session_id          VARCHAR(120) UNIQUE NOT NULL,   -- cs_xxx
  payment_intent_id   VARCHAR(120),
  -- Detalhes
  amount_cents        BIGINT NOT NULL,                 -- valor a creditar
  currency            VARCHAR(10) NOT NULL DEFAULT 'brl',
  payment_method_types TEXT[] DEFAULT ARRAY['card','pix','boleto'],
  -- Status do checkout
  status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','complete','expired','canceled','failed')),
  -- URLs
  success_url         TEXT,
  cancel_url          TEXT,
  checkout_url        TEXT,
  -- Auditoria
  created_by          INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stripe_sessions_tenant  ON stripe_checkout_sessions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_status  ON stripe_checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_session ON stripe_checkout_sessions(session_id);
