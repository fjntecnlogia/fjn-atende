-- =====================================================================
-- Log de opt-outs (audit trail)
-- =====================================================================

CREATE TABLE IF NOT EXISTS optout_events (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone        VARCHAR(30) NOT NULL,
  -- Origem do opt-out
  source       VARCHAR(40) NOT NULL DEFAULT 'user_replied_stop',
                 -- valores: 'user_replied_stop' (cliente respondeu PARAR)
                 --        'manual_admin' (admin removeu manualmente)
                 --        'bounce' (mensagem não entregue 3x)
                 --        'import' (já veio opt-out na lista)
  trigger_message TEXT,   -- a mensagem que disparou (ex: "parar")
  lists_updated_count   INTEGER NOT NULL DEFAULT 0,
  campaigns_affected    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optout_events_tenant ON optout_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optout_events_phone  ON optout_events(phone);
