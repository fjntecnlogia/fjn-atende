-- =====================================================================
-- CRM admin — notas internas por tenant
-- =====================================================================
-- Anotações privadas que só super-admin enxerga.
-- Útil pra rastrear conversas comerciais, casos de suporte, observações.

CREATE TABLE IF NOT EXISTS tenant_notes (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id     INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  author_name   VARCHAR(120),  -- snapshot caso o usuário seja removido
  body          TEXT NOT NULL,
  category      VARCHAR(30) NOT NULL DEFAULT 'general',
                  -- 'general' | 'support' | 'billing' | 'sales' | 'churn_risk'
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notes_tenant
  ON tenant_notes(tenant_id, pinned DESC, created_at DESC);
