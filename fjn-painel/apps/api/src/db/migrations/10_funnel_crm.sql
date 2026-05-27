-- =====================================================================
-- FUNIL DE ATENDIMENTO (CRM) — múltiplos pipelines + times + Kanban
-- =====================================================================
-- Multi-tenant. Tudo isolado por tenant_id.
-- 4 conceitos centrais:
--   pipelines       → funis (Comercial, Suporte, etc) — múltiplos por tenant
--   pipeline_stages → etapas de cada funil (Novo, Qualificando, Ganho...)
--   teams           → equipes (com round-robin opcional)
--   conversation_cards → cada conversa pode estar em N funis
--                        (uma conversa pode estar simultaneamente
--                         em "Comercial: Negociação" e "Suporte: Aberto")

-- =====================================================================
-- 1. PIPELINES (funis customizáveis)
-- =====================================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(60) NOT NULL,
  description  TEXT,
  color        VARCHAR(7) DEFAULT '#FFBA00',
  icon         VARCHAR(40) DEFAULT 'briefcase', -- nome do ícone lucide
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,  -- pipeline que recebe cards automaticamente
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipelines_tenant ON pipelines(tenant_id) WHERE archived = FALSE;
-- Um tenant só pode ter UM pipeline default
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_default_per_tenant
  ON pipelines(tenant_id) WHERE is_default = TRUE AND archived = FALSE;

-- =====================================================================
-- 2. PIPELINE_STAGES (etapas de cada pipeline)
-- =====================================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id               SERIAL PRIMARY KEY,
  pipeline_id      INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name             VARCHAR(60) NOT NULL,
  color            VARCHAR(7) DEFAULT '#1A2358',
  sort_order       INTEGER NOT NULL,
  sla_hours        INTEGER,                       -- alerta se ficar parado > X horas
  is_won           BOOLEAN NOT NULL DEFAULT FALSE, -- marca como fechado positivo
  is_lost          BOOLEAN NOT NULL DEFAULT FALSE, -- fechado negativo
  win_probability  SMALLINT NOT NULL DEFAULT 50,   -- 0-100, usado em forecast
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id, sort_order);

-- =====================================================================
-- 3. TEAMS (equipes de atendimento)
-- =====================================================================
CREATE TABLE IF NOT EXISTS teams (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 VARCHAR(60) NOT NULL,
  description          TEXT,
  color                VARCHAR(7) DEFAULT '#1A2358',
  assignment_strategy  VARCHAR(20) NOT NULL DEFAULT 'manual',
                       -- manual       = atendente do time pega manualmente
                       -- round_robin  = sistema distribui equilibrado
                       -- least_busy   = vai pra quem tem menos cards abertos
  business_hours       JSONB,  -- {"mon": [{"start":"08:00","end":"18:00"}], ...}
  archived             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id) WHERE archived = FALSE;

-- =====================================================================
-- 4. TEAM_MEMBERS (relação N:N entre times e usuários)
-- =====================================================================
CREATE TABLE IF NOT EXISTS team_members (
  team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  is_lead      BOOLEAN NOT NULL DEFAULT FALSE,
  available    BOOLEAN NOT NULL DEFAULT TRUE,    -- online/disponível pro round-robin
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- =====================================================================
-- 5. CONVERSATION_CARDS (vincula uma conversa a um pipeline/etapa/owner)
-- Uma conversa pode estar em VÁRIOS pipelines simultaneamente.
-- =====================================================================
CREATE TABLE IF NOT EXISTS conversation_cards (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id       INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pipeline_id           INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id              INTEGER NOT NULL REFERENCES pipeline_stages(id),
  assigned_user_id      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  value_cents           BIGINT NOT NULL DEFAULT 0,  -- valor da oportunidade
  expected_close_date   DATE,
  won_at                TIMESTAMPTZ,
  lost_at               TIMESTAMPTZ,
  lost_reason           TEXT,
  custom_fields         JSONB NOT NULL DEFAULT '{}',
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  stage_entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- pra calcular tempo na etapa
  next_action_at        TIMESTAMPTZ,                          -- follow-up agendado
  next_action_note      TEXT,
  position              INTEGER NOT NULL DEFAULT 0,           -- posição dentro da coluna (Kanban)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- mesma conversa só pode estar 1x em cada pipeline
  UNIQUE (conversation_id, pipeline_id)
);
CREATE INDEX IF NOT EXISTS idx_cards_tenant            ON conversation_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_conversation      ON conversation_cards(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cards_pipeline_stage    ON conversation_cards(pipeline_id, stage_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_assigned_user     ON conversation_cards(assigned_user_id)
  WHERE assigned_user_id IS NOT NULL AND won_at IS NULL AND lost_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_assigned_team     ON conversation_cards(assigned_team_id)
  WHERE assigned_team_id IS NOT NULL AND won_at IS NULL AND lost_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_next_action       ON conversation_cards(next_action_at)
  WHERE next_action_at IS NOT NULL AND won_at IS NULL AND lost_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_open              ON conversation_cards(tenant_id, pipeline_id)
  WHERE won_at IS NULL AND lost_at IS NULL;

-- =====================================================================
-- 6. CARD_HISTORY (audit trail de movimentações)
-- =====================================================================
CREATE TABLE IF NOT EXISTS card_history (
  id           BIGSERIAL PRIMARY KEY,
  card_id      BIGINT NOT NULL REFERENCES conversation_cards(id) ON DELETE CASCADE,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action       VARCHAR(40) NOT NULL,
                 -- created | moved_stage | assigned_user | unassigned_user
                 -- | assigned_team | won | lost | reopened | value_changed
                 -- | note_added | tag_added | tag_removed
  from_value   JSONB,
  to_value     JSONB,
  reason       TEXT,
  changed_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_card_history_card    ON card_history(card_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_history_tenant  ON card_history(tenant_id, changed_at DESC);

-- =====================================================================
-- 7. CARD_ACTIVITIES (notas, tarefas, ligações, reuniões)
-- =====================================================================
CREATE TABLE IF NOT EXISTS card_activities (
  id           BIGSERIAL PRIMARY KEY,
  card_id      BIGINT NOT NULL REFERENCES conversation_cards(id) ON DELETE CASCADE,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL DEFAULT 'note',  -- note | task | call | meeting | email
  title        TEXT,
  body         TEXT,
  due_at       TIMESTAMPTZ,
  done_at      TIMESTAMPTZ,
  created_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_card_activities_card     ON card_activities(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_activities_pending  ON card_activities(due_at)
  WHERE done_at IS NULL AND due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_card_activities_tenant   ON card_activities(tenant_id, due_at)
  WHERE done_at IS NULL;

-- =====================================================================
-- 8. ROUND_ROBIN_STATE (mantém último atendente sorteado por time)
-- =====================================================================
CREATE TABLE IF NOT EXISTS team_round_robin_state (
  team_id          INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  last_user_id     INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMPTZ
);

-- =====================================================================
-- 9. SEED — Pipeline padrão "Atendimento" pra tenants existentes
-- =====================================================================
INSERT INTO pipelines (tenant_id, name, description, is_default, sort_order, color)
SELECT t.id, 'Atendimento', 'Funil padrão criado automaticamente', TRUE, 0, '#FFBA00'
  FROM tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM pipelines p WHERE p.tenant_id = t.id AND p.is_default = TRUE
 );

-- Etapas padrão pra cada pipeline default recém criado
INSERT INTO pipeline_stages (pipeline_id, name, color, sort_order, win_probability, is_won, is_lost)
SELECT p.id, s.name, s.color, s.sort_order, s.win_probability, s.is_won, s.is_lost
  FROM pipelines p
 CROSS JOIN (VALUES
    ('Novo',              '#3B82F6', 0,  10, FALSE, FALSE),
    ('Qualificando',      '#8B5CF6', 1,  25, FALSE, FALSE),
    ('Proposta enviada',  '#F59E0B', 2,  50, FALSE, FALSE),
    ('Negociação',        '#FB923C', 3,  75, FALSE, FALSE),
    ('Ganho',             '#22C55E', 4, 100, TRUE,  FALSE),
    ('Perdido',           '#EF4444', 5,   0, FALSE, TRUE )
  ) AS s(name, color, sort_order, win_probability, is_won, is_lost)
 WHERE p.is_default = TRUE
   AND NOT EXISTS (
     SELECT 1 FROM pipeline_stages ps WHERE ps.pipeline_id = p.id
   );

-- =====================================================================
-- 10. VIEW — métricas agregadas por pipeline/stage
-- =====================================================================
CREATE OR REPLACE VIEW pipeline_metrics_view AS
SELECT
  c.tenant_id,
  c.pipeline_id,
  c.stage_id,
  COUNT(*)                                                              AS card_count,
  SUM(c.value_cents)                                                    AS total_value_cents,
  COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - c.stage_entered_at)) / 3600), 0)::INT AS avg_hours_in_stage,
  COUNT(*) FILTER (WHERE c.won_at IS NOT NULL)                          AS won_count,
  COUNT(*) FILTER (WHERE c.lost_at IS NOT NULL)                         AS lost_count,
  COUNT(*) FILTER (WHERE c.won_at IS NULL AND c.lost_at IS NULL)        AS open_count
FROM conversation_cards c
GROUP BY c.tenant_id, c.pipeline_id, c.stage_id;

-- =====================================================================
-- 11. VIEW — performance por atendente
-- =====================================================================
CREATE OR REPLACE VIEW user_performance_view AS
SELECT
  c.tenant_id,
  c.assigned_user_id                                            AS user_id,
  u.name                                                        AS user_name,
  COUNT(*) FILTER (WHERE c.won_at IS NULL AND c.lost_at IS NULL) AS open_cards,
  COUNT(*) FILTER (WHERE c.won_at IS NOT NULL)                  AS won_cards,
  COUNT(*) FILTER (WHERE c.lost_at IS NOT NULL)                 AS lost_cards,
  COALESCE(SUM(c.value_cents) FILTER (WHERE c.won_at IS NOT NULL), 0) AS won_value_cents,
  COALESCE(SUM(c.value_cents) FILTER (WHERE c.won_at IS NULL AND c.lost_at IS NULL), 0) AS pipeline_value_cents,
  COALESCE(AVG(EXTRACT(EPOCH FROM (c.won_at - c.created_at)) / 86400)
           FILTER (WHERE c.won_at IS NOT NULL), 0)::INT          AS avg_days_to_win
FROM conversation_cards c
JOIN admin_users u ON u.id = c.assigned_user_id
GROUP BY c.tenant_id, c.assigned_user_id, u.name;

-- =====================================================================
-- 12. FUNÇÃO — mover card de etapa (atualiza stage_entered_at + history)
-- =====================================================================
CREATE OR REPLACE FUNCTION move_card_to_stage(
  p_card_id     BIGINT,
  p_new_stage   INTEGER,
  p_user_id     INTEGER,
  p_reason      TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_stage   INTEGER;
  v_tenant      INTEGER;
  v_is_won      BOOLEAN;
  v_is_lost     BOOLEAN;
BEGIN
  -- captura estado atual
  SELECT stage_id, tenant_id INTO v_old_stage, v_tenant
    FROM conversation_cards WHERE id = p_card_id;

  IF v_old_stage = p_new_stage THEN RETURN; END IF;

  -- pega flags da nova etapa
  SELECT is_won, is_lost INTO v_is_won, v_is_lost
    FROM pipeline_stages WHERE id = p_new_stage;

  -- atualiza card
  UPDATE conversation_cards
     SET stage_id = p_new_stage,
         stage_entered_at = NOW(),
         won_at = CASE WHEN v_is_won  THEN NOW() ELSE NULL END,
         lost_at= CASE WHEN v_is_lost THEN NOW() ELSE NULL END,
         updated_at = NOW()
   WHERE id = p_card_id;

  -- grava histórico
  INSERT INTO card_history (card_id, tenant_id, action, from_value, to_value, reason, changed_by)
  VALUES (
    p_card_id, v_tenant,
    CASE
      WHEN v_is_won  THEN 'won'
      WHEN v_is_lost THEN 'lost'
      ELSE 'moved_stage'
    END,
    jsonb_build_object('stage_id', v_old_stage),
    jsonb_build_object('stage_id', p_new_stage),
    p_reason, p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 13. FUNÇÃO — round-robin: pega próximo membro disponível do time
-- =====================================================================
CREATE OR REPLACE FUNCTION pick_next_team_member(p_team_id INTEGER)
  RETURNS INTEGER AS $$
DECLARE
  v_last_user  INTEGER;
  v_next_user  INTEGER;
BEGIN
  SELECT last_user_id INTO v_last_user FROM team_round_robin_state WHERE team_id = p_team_id;

  -- Próximo na ordem (user_id > último); se chegou no fim, volta pro primeiro
  SELECT tm.user_id INTO v_next_user
    FROM team_members tm
    JOIN admin_users u ON u.id = tm.user_id AND u.active = TRUE
   WHERE tm.team_id = p_team_id
     AND tm.available = TRUE
     AND (v_last_user IS NULL OR tm.user_id > v_last_user)
   ORDER BY tm.user_id ASC
   LIMIT 1;

  -- Se não achou (já passou pelo último), começa do início
  IF v_next_user IS NULL THEN
    SELECT tm.user_id INTO v_next_user
      FROM team_members tm
      JOIN admin_users u ON u.id = tm.user_id AND u.active = TRUE
     WHERE tm.team_id = p_team_id
       AND tm.available = TRUE
     ORDER BY tm.user_id ASC
     LIMIT 1;
  END IF;

  -- Atualiza state
  IF v_next_user IS NOT NULL THEN
    INSERT INTO team_round_robin_state (team_id, last_user_id, last_assigned_at)
    VALUES (p_team_id, v_next_user, NOW())
    ON CONFLICT (team_id) DO UPDATE
      SET last_user_id = v_next_user, last_assigned_at = NOW();
  END IF;

  RETURN v_next_user;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 14. FUNÇÃO — auto-criar card quando conversa nova chega
-- Chamada pelo backend depois de inserir uma conversation
-- =====================================================================
CREATE OR REPLACE FUNCTION create_default_card_for_conversation(
  p_conversation_id INTEGER,
  p_tenant_id       INTEGER
) RETURNS BIGINT AS $$
DECLARE
  v_pipeline_id  INTEGER;
  v_stage_id     INTEGER;
  v_card_id      BIGINT;
BEGIN
  -- Acha pipeline default do tenant
  SELECT id INTO v_pipeline_id
    FROM pipelines
   WHERE tenant_id = p_tenant_id AND is_default = TRUE AND archived = FALSE
   LIMIT 1;

  IF v_pipeline_id IS NULL THEN RETURN NULL; END IF;

  -- Primeira etapa (sort_order menor)
  SELECT id INTO v_stage_id
    FROM pipeline_stages
   WHERE pipeline_id = v_pipeline_id
   ORDER BY sort_order ASC
   LIMIT 1;

  IF v_stage_id IS NULL THEN RETURN NULL; END IF;

  -- Cria card (se já existir, ON CONFLICT não dá erro)
  INSERT INTO conversation_cards (tenant_id, conversation_id, pipeline_id, stage_id)
  VALUES (p_tenant_id, p_conversation_id, v_pipeline_id, v_stage_id)
  ON CONFLICT (conversation_id, pipeline_id) DO NOTHING
  RETURNING id INTO v_card_id;

  -- Histórico
  IF v_card_id IS NOT NULL THEN
    INSERT INTO card_history (card_id, tenant_id, action, to_value)
    VALUES (v_card_id, p_tenant_id, 'created',
            jsonb_build_object('stage_id', v_stage_id, 'pipeline_id', v_pipeline_id));
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql;
