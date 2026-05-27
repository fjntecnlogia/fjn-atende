-- =====================================================================
-- FJN Disparo — módulo de Campanhas (envio em massa via WhatsApp)
--
-- Multi-tenant. Tudo isolado por tenant_id.
-- Provider-agnóstico (WPP-Connect | Meta Cloud API).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Listas de contatos (cada tenant pode ter várias)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_lists (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  source      VARCHAR(40),       -- "upload_csv", "manual", "api", "import_atendimento"
  -- Estatísticas cacheadas (atualizadas via trigger)
  total_count    INTEGER NOT NULL DEFAULT 0,
  optin_count    INTEGER NOT NULL DEFAULT 0,  -- opted-in (já conversaram OU deram consentimento)
  optout_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_tenant ON contact_lists(tenant_id);

-- ---------------------------------------------------------------------
-- 2. Contatos dentro das listas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_list_items (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  list_id         INTEGER NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  -- Dados básicos
  phone           VARCHAR(30) NOT NULL,
  name            VARCHAR(120),
  email           VARCHAR(120),
  -- Variáveis customizadas (pra substituição em template)
  -- Ex: {"empresa": "ACME", "plano": "Pro", "valor": "299"}
  variables       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Status opt-in
  opted_in        BOOLEAN NOT NULL DEFAULT FALSE,
  opted_in_at     TIMESTAMPTZ,
  opted_out       BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at    TIMESTAMPTZ,
  opted_out_reason VARCHAR(120),  -- "user_replied_stop", "manual", "bounce"
  -- Validação
  phone_valid     BOOLEAN NOT NULL DEFAULT TRUE,
  last_message_status VARCHAR(20),  -- "sent", "delivered", "read", "failed", "blocked"
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(list_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_cli_tenant ON contact_list_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cli_list   ON contact_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_cli_phone  ON contact_list_items(phone);

-- ---------------------------------------------------------------------
-- 3. Templates de mensagem (reutilizáveis)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  -- Categoria pro Meta Cloud (marketing, authentication, utility)
  category    VARCHAR(40) NOT NULL DEFAULT 'marketing',
  -- Corpo da mensagem com variáveis {{nome}} {{empresa}} etc
  body        TEXT NOT NULL,
  -- Mídia opcional
  media_type  VARCHAR(20),    -- "image", "video", "document", null
  media_url   TEXT,
  -- Para Meta Cloud: nome do template aprovado lá
  meta_template_name   VARCHAR(120),
  meta_template_status VARCHAR(20),  -- "pending", "approved", "rejected"
  meta_language        VARCHAR(10) DEFAULT 'pt_BR',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON message_templates(tenant_id);

-- ---------------------------------------------------------------------
-- 4. Campanhas (cada disparo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  -- Provider escolhido pra esse disparo
  provider        VARCHAR(20) NOT NULL DEFAULT 'wppconnect'
                    CHECK (provider IN ('wppconnect', 'meta_cloud', 'evolution', 'ultramsg')),
  -- Instância WhatsApp usada (qual chip envia)
  instance_id     INTEGER REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  -- Origem dos destinatários
  list_id         INTEGER REFERENCES contact_lists(id) ON DELETE RESTRICT,
  -- Template usado (ou texto custom)
  template_id     INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
  custom_body     TEXT,            -- usado se sem template
  media_type      VARCHAR(20),
  media_url       TEXT,
  -- Status da campanha
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','running','paused','completed','canceled','failed')),
  -- Agendamento
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Anti-ban
  rate_per_min    INTEGER NOT NULL DEFAULT 10,   -- máx msgs/min
  jitter_seconds  INTEGER NOT NULL DEFAULT 5,     -- variação aleatória
  -- Filtros aplicados (só opt-in? excluir opt-out? etc)
  filters         JSONB NOT NULL DEFAULT '{"only_opted_in":true,"exclude_opted_out":true}'::jsonb,
  -- Contadores (atualizados em tempo real conforme envia)
  total_count     INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  opted_out_count INTEGER NOT NULL DEFAULT 0,
  -- Auto-pause se taxa de bloqueio > X%
  auto_pause_on_block_pct  NUMERIC(5,2) DEFAULT 10.0,
  -- Auditoria
  created_by      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- ---------------------------------------------------------------------
-- 5. Destinatários individuais de cada campanha (snapshot)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_item_id INTEGER REFERENCES contact_list_items(id) ON DELETE SET NULL,
  -- Snapshot do contato no momento da criação (caso a lista mude depois)
  phone           VARCHAR(30) NOT NULL,
  name            VARCHAR(120),
  variables       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Corpo final renderizado (com variáveis substituídas)
  rendered_body   TEXT,
  -- Estado de envio
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','queued','sending','sent','delivered','read','failed','skipped','opted_out')),
  -- Tracking
  external_id     VARCHAR(120),     -- ID da msg no provider
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failed_reason   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipients_tenant   ON campaign_recipients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_pending  ON campaign_recipients(status, campaign_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recipients_external ON campaign_recipients(external_id) WHERE external_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Atualiza tenant_usage com counter de campanhas
-- ---------------------------------------------------------------------
ALTER TABLE tenant_usage ADD COLUMN IF NOT EXISTS campaign_messages_sent INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 7. Atualiza plans com limites específicos pra campanhas
-- ---------------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_campaign_messages_month INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_contact_list_size       INTEGER DEFAULT 1000;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_campaigns             BOOLEAN DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_meta_cloud            BOOLEAN DEFAULT FALSE;

-- Seed atualizado dos planos (idempotente — só atualiza colunas novas)
UPDATE plans SET
  max_campaign_messages_month = CASE slug
    WHEN 'trial'      THEN 100
    WHEN 'starter'    THEN 2000
    WHEN 'pro'        THEN 10000
    WHEN 'enterprise' THEN 0   -- ilimitado
    ELSE 0
  END,
  max_contact_list_size = CASE slug
    WHEN 'trial'      THEN 100
    WHEN 'starter'    THEN 2000
    WHEN 'pro'        THEN 20000
    WHEN 'enterprise' THEN 0   -- ilimitado
    ELSE 1000
  END,
  allow_meta_cloud = (slug IN ('pro','enterprise')),
  allow_campaigns = TRUE;

-- ---------------------------------------------------------------------
-- 8. Configuração Meta Cloud por tenant (opcional)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_meta_cloud (
  tenant_id              INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id        VARCHAR(60),
  business_account_id    VARCHAR(60),
  access_token           TEXT,                -- criptografar antes de armazenar (TODO)
  display_phone_number   VARCHAR(30),
  status                 VARCHAR(20) DEFAULT 'inactive',  -- inactive | active | suspended
  configured_at          TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 9. Triggers de manutenção (counters)
-- ---------------------------------------------------------------------

-- Atualiza total_count na lista quando insere/remove items
CREATE OR REPLACE FUNCTION update_list_counters() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_lists
       SET total_count  = total_count + 1,
           optin_count  = optin_count + (CASE WHEN NEW.opted_in THEN 1 ELSE 0 END),
           optout_count = optout_count + (CASE WHEN NEW.opted_out THEN 1 ELSE 0 END),
           updated_at   = NOW()
     WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_lists
       SET total_count  = GREATEST(total_count - 1, 0),
           optin_count  = GREATEST(optin_count - (CASE WHEN OLD.opted_in THEN 1 ELSE 0 END), 0),
           optout_count = GREATEST(optout_count - (CASE WHEN OLD.opted_out THEN 1 ELSE 0 END), 0),
           updated_at   = NOW()
     WHERE id = OLD.list_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_list_counters ON contact_list_items;
CREATE TRIGGER trg_list_counters
  AFTER INSERT OR DELETE ON contact_list_items
  FOR EACH ROW EXECUTE FUNCTION update_list_counters();
