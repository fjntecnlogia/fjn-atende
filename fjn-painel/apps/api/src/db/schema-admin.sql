-- ============================================================
-- Schema adicional do PAINEL — roda em cima do schema do
-- fjn-atendimento (mesmo banco)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(120) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','agent')),
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ============================================================
-- Notas internas em uma conversa (visíveis só pra equipe)
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_notes (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  admin_user_id   INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_conversation ON conversation_notes(conversation_id);

-- ============================================================
-- Mensagens lidas pelo painel (controle de "não lidas")
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- ============================================================
-- Triggers para realtime via LISTEN/NOTIFY
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_handoff() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('new_handoff', json_build_object(
    'id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'reason', NEW.reason
  )::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_handoff ON handoffs;
CREATE TRIGGER trg_notify_handoff
  AFTER INSERT ON handoffs
  FOR EACH ROW EXECUTE FUNCTION notify_new_handoff();

CREATE OR REPLACE FUNCTION notify_new_message() RETURNS trigger AS $$
BEGIN
  IF NEW.role IN ('user','assistant','human_agent') THEN
    PERFORM pg_notify('new_message', json_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'role', NEW.role
    )::text);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_message ON messages;
CREATE TRIGGER trg_notify_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
