-- =====================================================================
-- DOCUMENTOS — Orçamentos e Contratos
-- =====================================================================
-- 4 tabelas:
--   document_templates  — modelos reutilizáveis (HTML + variáveis)
--   documents           — orçamento/contrato vinculado a um card
--   document_items      — linha por linha (produto, qtd, valor)
--   document_events     — audit trail (created, sent, viewed, approved...)
--
-- Fluxo típico:
--   Card em "Proposta" → Cria orçamento → Adiciona itens →
--   Gera PDF → Envia WhatsApp → Cliente aprova →
--   Converte em contrato → Assinatura (Clicksign, Release 3) → Ganho

-- =====================================================================
-- 1. DOCUMENT_TEMPLATES
-- =====================================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(120) NOT NULL,
  type             VARCHAR(20) NOT NULL DEFAULT 'quote',
                     -- 'quote'   = orçamento
                     -- 'contract'= contrato
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Conteúdo:
  header_html      TEXT,       -- cabeçalho (aparece no topo de cada página)
  body_html        TEXT NOT NULL,  -- corpo com {{vars}}
  footer_html      TEXT,       -- rodapé
  css_style        TEXT,       -- CSS customizado do template
  -- Defaults preenchidos ao criar documento novo:
  default_terms    TEXT,       -- termos e condições
  default_validity_days INTEGER DEFAULT 15,  -- validade do orçamento em dias
  default_payment_terms TEXT,  -- ex: "50% na assinatura, 50% na entrega"
  -- Metadata:
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_templates_tenant ON document_templates(tenant_id, type)
  WHERE archived = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_templates_default_per_type
  ON document_templates(tenant_id, type) WHERE is_default = TRUE AND archived = FALSE;

-- =====================================================================
-- 2. DOCUMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS documents (
  id                   BIGSERIAL PRIMARY KEY,
  tenant_id            INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id              BIGINT REFERENCES conversation_cards(id) ON DELETE SET NULL,
  conversation_id      INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  template_id          INTEGER REFERENCES document_templates(id) ON DELETE SET NULL,
  -- Identificação:
  number               INTEGER NOT NULL,    -- sequencial por tenant
  type                 VARCHAR(20) NOT NULL DEFAULT 'quote',  -- 'quote' | 'contract'
  revision             INTEGER NOT NULL DEFAULT 1,
  parent_document_id   BIGINT REFERENCES documents(id) ON DELETE SET NULL,  -- pra revisões
  -- Cliente (snapshot no momento da criação — pra manter integridade se contato mudar):
  client_name          VARCHAR(200),
  client_document      VARCHAR(50),  -- CPF/CNPJ
  client_email         VARCHAR(200),
  client_phone         VARCHAR(50),
  client_address       TEXT,
  -- Valores:
  subtotal_cents       BIGINT NOT NULL DEFAULT 0,
  discount_cents       BIGINT NOT NULL DEFAULT 0,
  discount_pct         NUMERIC(5,2),
  tax_cents            BIGINT NOT NULL DEFAULT 0,
  total_cents          BIGINT NOT NULL DEFAULT 0,
  -- Termos:
  terms                TEXT,
  payment_terms        TEXT,
  validity_days        INTEGER,
  expires_at           TIMESTAMPTZ,
  -- Status:
  status               VARCHAR(30) NOT NULL DEFAULT 'draft',
                         -- draft | sent | viewed | approved | rejected | expired | canceled | converted
  -- Assinatura (Release 3):
  signature_provider   VARCHAR(30),          -- 'clicksign' | 'd4sign' | null
  signature_request_id VARCHAR(200),         -- ID no provider
  signed_at            TIMESTAMPTZ,
  signed_pdf_url       TEXT,
  -- PDF gerado:
  pdf_url              TEXT,                 -- URL/path do PDF atual
  pdf_generated_at     TIMESTAMPTZ,
  -- Metadata:
  notes                TEXT,                 -- observação interna
  created_by           INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  sent_at              TIMESTAMPTZ,
  viewed_at            TIMESTAMPTZ,
  approved_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  rejected_reason      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_docs_tenant     ON documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_card       ON documents(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_conv       ON documents(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_status     ON documents(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_number_tenant
  ON documents(tenant_id, type, number);

-- =====================================================================
-- 3. DOCUMENT_ITEMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS document_items (
  id                BIGSERIAL PRIMARY KEY,
  document_id       BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL DEFAULT 0,
  code              VARCHAR(60),      -- SKU/código do produto (opcional)
  description       TEXT NOT NULL,    -- descrição do item
  quantity          NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit              VARCHAR(20),      -- 'un', 'm²', 'hora', etc
  unit_price_cents  BIGINT NOT NULL DEFAULT 0,
  discount_cents    BIGINT NOT NULL DEFAULT 0,
  discount_pct      NUMERIC(5,2),
  subtotal_cents    BIGINT NOT NULL DEFAULT 0,  -- (qty * unit_price) - discount
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_items_document ON document_items(document_id, position);

-- =====================================================================
-- 4. DOCUMENT_EVENTS (audit trail)
-- =====================================================================
CREATE TABLE IF NOT EXISTS document_events (
  id              BIGSERIAL PRIMARY KEY,
  document_id     BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
                    -- created | edited | items_updated | pdf_generated
                    -- | sent_whatsapp | sent_email | viewed | approved
                    -- | rejected | expired | canceled | revision_created
                    -- | converted_to_contract | signature_requested | signed
  payload         JSONB DEFAULT '{}',
  actor_id        INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name      VARCHAR(120),  -- snapshot
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_events_document ON document_events(document_id, created_at DESC);

-- =====================================================================
-- 5. FUNÇÕES helpers
-- =====================================================================

-- Gera próximo número por tipo (quote e contract têm contagens separadas)
CREATE OR REPLACE FUNCTION next_document_number(p_tenant_id INTEGER, p_type VARCHAR)
  RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next
    FROM documents
   WHERE tenant_id = p_tenant_id AND type = p_type;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Recalcula totais do documento a partir dos itens
CREATE OR REPLACE FUNCTION recalculate_document_totals(p_document_id BIGINT)
  RETURNS VOID AS $$
DECLARE
  v_subtotal BIGINT;
  v_discount_pct NUMERIC(5,2);
  v_discount_cents BIGINT;
  v_tax_cents BIGINT;
BEGIN
  -- Soma dos subtotais dos itens
  SELECT COALESCE(SUM(subtotal_cents), 0) INTO v_subtotal
    FROM document_items WHERE document_id = p_document_id;

  -- Pega desconto/imposto do documento
  SELECT discount_pct, discount_cents, tax_cents
    INTO v_discount_pct, v_discount_cents, v_tax_cents
    FROM documents WHERE id = p_document_id;

  -- Aplica desconto: se pct definido, calcula; senão usa cents fixo
  IF v_discount_pct IS NOT NULL AND v_discount_pct > 0 THEN
    v_discount_cents := (v_subtotal * v_discount_pct / 100)::BIGINT;
  END IF;

  UPDATE documents
     SET subtotal_cents = v_subtotal,
         discount_cents = COALESCE(v_discount_cents, 0),
         total_cents    = v_subtotal - COALESCE(v_discount_cents, 0) + COALESCE(v_tax_cents, 0),
         updated_at     = NOW()
   WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- Recalcula subtotal de UM item (qty * unit_price - discount)
CREATE OR REPLACE FUNCTION recalculate_item_subtotal()
  RETURNS TRIGGER AS $$
BEGIN
  -- Se desconto pct definido, calcula; senão usa cents
  IF NEW.discount_pct IS NOT NULL AND NEW.discount_pct > 0 THEN
    NEW.discount_cents := ((NEW.quantity * NEW.unit_price_cents) * NEW.discount_pct / 100)::BIGINT;
  END IF;
  NEW.subtotal_cents := (NEW.quantity * NEW.unit_price_cents)::BIGINT - COALESCE(NEW.discount_cents, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_item_subtotal ON document_items;
CREATE TRIGGER trg_recalc_item_subtotal
  BEFORE INSERT OR UPDATE ON document_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_item_subtotal();

-- =====================================================================
-- 6. SEED — template básico de orçamento pra cada tenant
-- =====================================================================
INSERT INTO document_templates
  (tenant_id, name, type, is_default, header_html, body_html, footer_html, css_style,
   default_terms, default_validity_days, default_payment_terms)
SELECT
  t.id,
  'Orçamento Padrão',
  'quote',
  TRUE,
  -- HEADER
  '<div class="doc-header">' ||
    '<div class="doc-header-left">' ||
      '<h1 class="doc-brand">{{tenant_name}}</h1>' ||
      '<p class="doc-subtitle">{{tenant_slug}}</p>' ||
    '</div>' ||
    '<div class="doc-header-right">' ||
      '<h2 class="doc-title">ORÇAMENTO Nº {{document_number}}</h2>' ||
      '<p class="doc-date">Emitido em {{issue_date}}</p>' ||
      '<p class="doc-validity">Válido até {{expires_at}}</p>' ||
    '</div>' ||
  '</div>',
  -- BODY
  '<div class="doc-client">' ||
    '<h3>Cliente</h3>' ||
    '<p><strong>{{client_name}}</strong></p>' ||
    '<p>{{client_document}} · {{client_phone}}</p>' ||
    '<p>{{client_email}}</p>' ||
    '<p>{{client_address}}</p>' ||
  '</div>' ||
  '<div class="doc-items">' ||
    '<h3>Itens</h3>' ||
    '{{items_table}}' ||
  '</div>' ||
  '<div class="doc-totals">' ||
    '<p>Subtotal: {{subtotal}}</p>' ||
    '<p>Desconto: - {{discount}}</p>' ||
    '<p class="doc-total"><strong>TOTAL: {{total}}</strong></p>' ||
  '</div>' ||
  '<div class="doc-terms">' ||
    '<h3>Condições de pagamento</h3>' ||
    '<p>{{payment_terms}}</p>' ||
    '<h3>Termos</h3>' ||
    '<p>{{terms}}</p>' ||
  '</div>',
  -- FOOTER
  '<div class="doc-footer">' ||
    '<p>Documento gerado por FJN Atende · {{tenant_name}}</p>' ||
  '</div>',
  -- CSS
  '.doc-header { display: flex; justify-content: space-between; padding: 20px; border-bottom: 3px solid #FFBA00; }
   .doc-brand { color: #0B1340; margin: 0; font-size: 24px; }
   .doc-subtitle { color: #666; margin: 0; font-size: 12px; }
   .doc-title { color: #FFBA00; margin: 0; font-size: 20px; text-align: right; }
   .doc-date, .doc-validity { color: #666; font-size: 11px; text-align: right; margin: 2px 0; }
   .doc-client { padding: 20px; background: #f8f9fa; margin: 20px; border-left: 4px solid #FFBA00; }
   .doc-client h3 { color: #0B1340; margin-top: 0; font-size: 13px; text-transform: uppercase; }
   .doc-items { padding: 0 20px; }
   .doc-items h3 { color: #0B1340; font-size: 13px; text-transform: uppercase; }
   .doc-items table { width: 100%; border-collapse: collapse; margin-top: 10px; }
   .doc-items th { background: #FFBA00; color: #0B1340; padding: 8px; text-align: left; font-size: 11px; }
   .doc-items td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
   .doc-totals { padding: 20px; text-align: right; }
   .doc-total { font-size: 20px; color: #FFBA00; }
   .doc-terms { padding: 20px; font-size: 11px; color: #444; }
   .doc-terms h3 { font-size: 12px; color: #0B1340; text-transform: uppercase; margin-bottom: 4px; }
   .doc-footer { padding: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; }',
  -- DEFAULTS
  'Valores sujeitos a alteração conforme escopo final. Impostos inclusos.',
  15,
  '50% na aprovação e 50% na entrega. Pagamento via PIX, boleto ou cartão em até 3x sem juros.'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates dt
   WHERE dt.tenant_id = t.id AND dt.type = 'quote' AND dt.is_default = TRUE
);

-- Template básico de CONTRATO
INSERT INTO document_templates
  (tenant_id, name, type, is_default, header_html, body_html, footer_html, css_style,
   default_terms, default_validity_days, default_payment_terms)
SELECT
  t.id,
  'Contrato Padrão',
  'contract',
  TRUE,
  '<div class="doc-header"><h1>CONTRATO Nº {{document_number}}</h1><p>{{tenant_name}}</p></div>',
  '<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>
   <p><strong>CONTRATADA:</strong> {{tenant_name}}</p>
   <p><strong>CONTRATANTE:</strong> {{client_name}}, {{client_document}}, {{client_address}}</p>
   <h3>1. OBJETO</h3>
   <p>Prestação dos seguintes serviços/produtos:</p>
   {{items_table}}
   <h3>2. VALOR TOTAL</h3>
   <p><strong>{{total}}</strong></p>
   <h3>3. CONDIÇÕES DE PAGAMENTO</h3>
   <p>{{payment_terms}}</p>
   <h3>4. TERMOS GERAIS</h3>
   <p>{{terms}}</p>
   <div style="margin-top:60px;">
     <p>_________________________________________</p>
     <p><strong>{{client_name}}</strong> — CONTRATANTE</p>
     <br/>
     <p>_________________________________________</p>
     <p><strong>{{tenant_name}}</strong> — CONTRATADA</p>
     <p>Data: {{issue_date}}</p>
   </div>',
  '<div class="doc-footer"><p>{{tenant_name}} · Documento gerado por FJN Atende</p></div>',
  'body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
   h1 { color: #0B1340; border-bottom: 2px solid #FFBA00; padding-bottom: 8px; }
   h2 { color: #0B1340; text-align: center; margin: 30px 0; }
   h3 { color: #FFBA00; text-transform: uppercase; font-size: 13px; }
   table { width: 100%; border-collapse: collapse; margin: 15px 0; }
   th { background: #f0f0f0; padding: 8px; text-align: left; }
   td { padding: 8px; border-bottom: 1px solid #eee; }',
  'Contrato regido pelas leis brasileiras. Foro da comarca da CONTRATADA.',
  30,
  'Conforme acordado entre as partes.'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates dt
   WHERE dt.tenant_id = t.id AND dt.type = 'contract' AND dt.is_default = TRUE
);
