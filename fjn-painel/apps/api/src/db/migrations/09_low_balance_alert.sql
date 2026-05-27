-- =====================================================================
-- Colunas pra alerta de saldo baixo
-- =====================================================================
-- low_balance_threshold_cents: abaixo disso, dispara e-mail (default R$ 10)
-- low_balance_notified_at:     última vez que avisamos (dedup 24h)

ALTER TABLE tenant_credits
  ADD COLUMN IF NOT EXISTS low_balance_threshold_cents INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS low_balance_notified_at TIMESTAMPTZ;

-- Índice pra acelerar o scan do worker (busca quem tá abaixo do threshold)
CREATE INDEX IF NOT EXISTS idx_tenant_credits_low_balance
  ON tenant_credits (tenant_id)
  WHERE balance_cents < low_balance_threshold_cents;
