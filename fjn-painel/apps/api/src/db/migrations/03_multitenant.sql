-- =====================================================================
-- FJN Atende — Migração para Multi-tenant
--
-- Adiciona: tabela tenants + tenant_id em todas as tabelas + RLS
-- + tabelas auxiliares (whatsapp_instances, tenant_knowledge, plans).
--
-- Idempotente — pode rodar várias vezes sem efeito colateral.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela mestra de tenants
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(60)  UNIQUE NOT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(120),
  phone           VARCHAR(30),
  plan            VARCHAR(20)  NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','canceled')),
  settings        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- branding: {logo_url, primary_color, accent_color, display_name}
  branding        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- persona da IA por tenant: {name, tone, rules, ...}
  ai_persona      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- prompt master customizado (sobrepõe o default)
  prompt_master   TEXT,
  -- número de WhatsApp pra notificar handoffs (formato: 5511999998888)
  notify_phone    VARCHAR(30),
  trial_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan   ON tenants(plan);

-- ---------------------------------------------------------------------
-- 2. Planos disponíveis (tabela de referência)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id                SERIAL PRIMARY KEY,
  slug              VARCHAR(40) UNIQUE NOT NULL,
  name              VARCHAR(80) NOT NULL,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents  INTEGER NOT NULL DEFAULT 0,
  -- limites
  max_messages_month  INTEGER NOT NULL DEFAULT 0,    -- 0 = ilimitado
  max_agents          INTEGER NOT NULL DEFAULT 1,
  max_instances       INTEGER NOT NULL DEFAULT 1,
  -- features (JSONB pra flexibilidade)
  features            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  position            INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed dos planos padrão (apenas se a tabela estiver vazia)
INSERT INTO plans (slug, name, price_monthly_cents, max_messages_month, max_agents, max_instances, features, position)
SELECT * FROM (VALUES
  ('trial',      'Teste Grátis',  0,      500,   1, 1, '{"trial":true,"days":14}'::jsonb, 0),
  ('starter',    'Starter',       19700,  2000,  2, 1, '{}'::jsonb, 1),
  ('pro',        'Pro',           49700,  10000, 5, 2, '{"priority_support":true}'::jsonb, 2),
  ('enterprise', 'Enterprise',    99700,  0,    20, 10,'{"priority_support":true,"white_label":true,"custom_domain":true}'::jsonb, 3)
) AS v(slug, name, price_monthly_cents, max_messages_month, max_agents, max_instances, features, position)
WHERE NOT EXISTS (SELECT 1 FROM plans);

-- ---------------------------------------------------------------------
-- 3. tenant_id em TODAS as tabelas operacionais
-- ---------------------------------------------------------------------
ALTER TABLE contacts            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE conversations       ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE messages            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leads               ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE handoffs            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE message_buffer      ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE admin_users         ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE conversation_notes  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes pra performance (tenant_id sempre presente em filtros)
CREATE INDEX IF NOT EXISTS idx_contacts_tenant            ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant       ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant            ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant               ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_tenant            ON handoffs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_buffer_tenant      ON message_buffer(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant         ON admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_tenant  ON conversation_notes(tenant_id);

-- Mesmo telefone pode ser cliente de tenants diferentes
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_phone_key;
DROP INDEX IF EXISTS idx_contacts_phone;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_phone_tenant_unique;
ALTER TABLE contacts ADD CONSTRAINT contacts_phone_tenant_unique UNIQUE (phone, tenant_id);

-- ---------------------------------------------------------------------
-- 4. Instâncias WhatsApp (uma por tenant — pode crescer pra várias)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_name       VARCHAR(120) UNIQUE NOT NULL,  -- "tenant-{id}-{slug}"
  session_token      TEXT,                          -- token gerado pelo WPP-Connect
  phone_number       VARCHAR(30),                   -- número conectado (após QR)
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','connecting','connected','disconnected','error')),
  last_qr            TEXT,                          -- último QR code (base64)
  last_qr_at         TIMESTAMPTZ,
  last_connected_at  TIMESTAMPTZ,
  metadata           JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant ON whatsapp_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);

-- ---------------------------------------------------------------------
-- 5. Dossiês customizáveis por tenant
--    (Substitui os arquivos .md hardcoded de produtos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_knowledge (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         VARCHAR(60) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_tenant ON tenant_knowledge(tenant_id);

-- ---------------------------------------------------------------------
-- 6. Uso mensal (para enforcement de limites do plano)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_usage (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period          DATE NOT NULL,           -- primeiro dia do mês
  messages_sent   INTEGER NOT NULL DEFAULT 0,
  messages_received INTEGER NOT NULL DEFAULT 0,
  conversations   INTEGER NOT NULL DEFAULT 0,
  ai_input_tokens BIGINT  NOT NULL DEFAULT 0,
  ai_output_tokens BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);

-- ---------------------------------------------------------------------
-- 7. Roles do admin_users (atualização)
-- ---------------------------------------------------------------------
-- Permite role 'super_admin' (acesso global, sem tenant) além das atuais
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'owner', 'admin', 'agent'));

-- super_admins não precisam de tenant_id (NULL permitido pra eles)
-- (constraint de FK já permite NULL por padrão)

-- ---------------------------------------------------------------------
-- 8. Row-Level Security (RLS) — defense in depth
--    O app FILTRA explicitamente por tenant_id em todas queries,
--    mas RLS é a 2ª camada de segurança caso alguma query esqueça.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::int;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_super_admin', true), ''), 'false')::boolean;
$$ LANGUAGE sql STABLE;

-- Habilita RLS em todas as tabelas tenant-scoped
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts','conversations','messages','leads','handoffs',
    'message_buffer','admin_users','conversation_notes',
    'whatsapp_instances','tenant_knowledge','tenant_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
      USING      (is_super_admin() OR tenant_id = current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id())
    $p$, t);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- 9. Tenant inicial = FJN Tecnologia (você é o tenant #1)
-- ---------------------------------------------------------------------
INSERT INTO tenants (id, slug, name, email, plan, status, branding, notify_phone)
VALUES (
  1,
  'fjn',
  'FJN Tecnologia',
  'fjntecnologia2022@gmail.com',
  'enterprise',
  'active',
  '{
    "display_name": "FJN Tecnologia",
    "primary_color": "#0B1340",
    "accent_color": "#FFBA00",
    "logo_url": null
  }'::jsonb,
  '556598090089'
)
ON CONFLICT (id) DO NOTHING;

-- Ajusta a sequence pra que o próximo tenant criado seja o #2
SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1));

-- ---------------------------------------------------------------------
-- 10. Backfill: associa registros existentes ao tenant FJN
--     (Como o banco está vazio na FASE 1, isso é só por garantia)
-- ---------------------------------------------------------------------
UPDATE contacts            SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE conversations       SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE messages            SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE leads               SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE handoffs            SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE message_buffer      SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE admin_users         SET tenant_id = 1 WHERE tenant_id IS NULL AND role != 'super_admin';
UPDATE conversation_notes  SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Agora torna tenant_id NOT NULL (depois do backfill)
ALTER TABLE contacts            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE conversations       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE messages            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE leads               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE handoffs            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE message_buffer      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE conversation_notes  ALTER COLUMN tenant_id SET NOT NULL;
-- admin_users.tenant_id permanece NULL pra super_admins
