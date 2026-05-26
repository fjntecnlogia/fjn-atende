-- =====================================================================
-- Desabilitar RLS — o filtro explícito por tenant_id nas queries é suficiente.
-- RLS estava bloqueando queries no Neon pooler (que não suporta
-- SET LOCAL app.tenant_id de forma confiável).
-- =====================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts','conversations','messages','leads','handoffs',
    'message_buffer','admin_users','conversation_notes',
    'whatsapp_instances','tenant_knowledge','tenant_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;
END$$;
