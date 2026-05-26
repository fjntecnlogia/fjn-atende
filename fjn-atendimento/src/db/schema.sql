-- ===========================================================
-- FJN Atendimento — Schema do banco
-- ===========================================================

CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  phone         VARCHAR(30) UNIQUE NOT NULL,
  name          VARCHAR(120),
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags          TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- ===========================================================

CREATE TABLE IF NOT EXISTS conversations (
  id                SERIAL PRIMARY KEY,
  contact_id        INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product_detected  VARCHAR(50),
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  bot_paused_until  TIMESTAMPTZ,
  assigned_to       VARCHAR(60),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- ===========================================================

CREATE TABLE IF NOT EXISTS messages (
  id               BIGSERIAL PRIMARY KEY,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'human_agent')),
  content          TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sent_at);

-- ===========================================================

CREATE TABLE IF NOT EXISTS leads (
  id            SERIAL PRIMARY KEY,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product       VARCHAR(50) NOT NULL,
  stage         VARCHAR(30) NOT NULL DEFAULT 'novo',
  notes         TEXT,
  qualified_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(contact_id);

-- ===========================================================

CREATE TABLE IF NOT EXISTS handoffs (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason          VARCHAR(60) NOT NULL,
  trigger_message TEXT,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  taken_at        TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_handoffs_conversation ON handoffs(conversation_id);

-- ===========================================================
-- Buffer de mensagens pendentes (debounce)
-- ===========================================================

CREATE TABLE IF NOT EXISTS message_buffer (
  id          BIGSERIAL PRIMARY KEY,
  phone       VARCHAR(30) NOT NULL,
  content     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_buffer_phone_unprocessed
  ON message_buffer(phone, processed) WHERE processed = FALSE;
