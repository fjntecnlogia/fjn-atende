-- =====================================================================
-- Número sequencial de card (#0001, #0002...) por tenant
-- =====================================================================
-- Cria coluna 'number' + sequência por tenant. Cada tenant tem sua
-- contagem própria começando em 1.

ALTER TABLE conversation_cards
  ADD COLUMN IF NOT EXISTS number INTEGER;

-- Backfill: numera cards existentes por ordem de criação
DO $$
DECLARE
  t_id INTEGER;
BEGIN
  FOR t_id IN SELECT DISTINCT tenant_id FROM conversation_cards WHERE number IS NULL
  LOOP
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
        FROM conversation_cards
       WHERE tenant_id = t_id
    )
    UPDATE conversation_cards c
       SET number = n.rn
      FROM numbered n
     WHERE c.id = n.id;
  END LOOP;
END $$;

-- Índice único por tenant (garante unicidade do número)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_number_tenant
  ON conversation_cards(tenant_id, number)
  WHERE number IS NOT NULL;

-- Função pra gerar próximo número ao criar card
CREATE OR REPLACE FUNCTION next_card_number(p_tenant_id INTEGER)
  RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next
    FROM conversation_cards
   WHERE tenant_id = p_tenant_id;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Atualiza a função create_default_card_for_conversation pra gerar número
CREATE OR REPLACE FUNCTION create_default_card_for_conversation(
  p_conversation_id INTEGER,
  p_tenant_id       INTEGER
) RETURNS BIGINT AS $$
DECLARE
  v_pipeline_id  INTEGER;
  v_stage_id     INTEGER;
  v_card_id      BIGINT;
  v_number       INTEGER;
BEGIN
  SELECT id INTO v_pipeline_id
    FROM pipelines
   WHERE tenant_id = p_tenant_id AND is_default = TRUE AND archived = FALSE
   LIMIT 1;

  IF v_pipeline_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_stage_id
    FROM pipeline_stages
   WHERE pipeline_id = v_pipeline_id
   ORDER BY sort_order ASC
   LIMIT 1;

  IF v_stage_id IS NULL THEN RETURN NULL; END IF;

  v_number := next_card_number(p_tenant_id);

  INSERT INTO conversation_cards (tenant_id, conversation_id, pipeline_id, stage_id, number)
  VALUES (p_tenant_id, p_conversation_id, v_pipeline_id, v_stage_id, v_number)
  ON CONFLICT (conversation_id, pipeline_id) DO NOTHING
  RETURNING id INTO v_card_id;

  IF v_card_id IS NOT NULL THEN
    INSERT INTO card_history (card_id, tenant_id, action, to_value)
    VALUES (v_card_id, p_tenant_id, 'created',
            jsonb_build_object('stage_id', v_stage_id, 'pipeline_id', v_pipeline_id, 'number', v_number));
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql;
