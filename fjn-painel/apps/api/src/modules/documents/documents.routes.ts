/**
 * Rotas de Documentos (orçamentos e contratos).
 *
 *  Templates:
 *    GET /documents/templates                    → lista templates do tenant
 *    POST /documents/templates                   → cria template
 *    PUT /documents/templates/:id                → atualiza
 *    DELETE /documents/templates/:id             → archive
 *
 *  Documentos:
 *    GET /documents?card_id=&status=&type=       → lista com filtros
 *    GET /documents/:id                          → detalhe + itens + eventos
 *    POST /documents                             → cria (a partir de card ou avulso)
 *    PUT /documents/:id                          → atualiza (cliente, termos, valores)
 *    DELETE /documents/:id                       → cancela
 *    POST /documents/:id/revision                → cria nova revisão
 *    POST /documents/:id/convert                 → orçamento → contrato
 *
 *  Ações:
 *    POST /documents/:id/send-whatsapp           → envia PDF via WhatsApp
 *    GET  /documents/:id/pdf                     → baixa PDF gerado on-the-fly
 *    POST /documents/:id/approve                 → marca aprovado
 *    POST /documents/:id/reject                  → marca rejeitado + motivo
 *
 *  Itens:
 *    POST /documents/:id/items                   → adiciona item
 *    PUT /documents/:id/items/:itemId            → atualiza item
 *    DELETE /documents/:id/items/:itemId         → remove
 *    PUT /documents/:id/items/reorder            → reordena
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import axios from "axios";
import { db } from "../../db/client";
import { config } from "../../config";
import { requireTenant, requireRole } from "../../lib/auth";
import { generateDocumentPdf } from "../../lib/pdf-generator";

// =====================================================================
// SCHEMAS
// =====================================================================
const templateSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(["quote", "contract"]).default("quote"),
  is_default: z.boolean().default(false),
  header_html: z.string().optional(),
  body_html: z.string().min(1),
  footer_html: z.string().optional(),
  css_style: z.string().optional(),
  default_terms: z.string().optional(),
  default_validity_days: z.number().int().min(1).max(365).default(15),
  default_payment_terms: z.string().optional(),
});

const documentCreateSchema = z.object({
  card_id: z.number().int().positive().optional(),
  conversation_id: z.number().int().positive().optional(),
  template_id: z.number().int().positive().optional(),
  type: z.enum(["quote", "contract"]).default("quote"),
  client_name: z.string().min(1).max(200),
  client_document: z.string().max(50).optional(),
  client_email: z.string().email().optional(),
  client_phone: z.string().max(50).optional(),
  client_address: z.string().optional(),
  validity_days: z.number().int().min(1).max(365).optional(),
  payment_terms: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
});

const documentUpdateSchema = documentCreateSchema.partial().omit({ card_id: true, conversation_id: true, type: true });

const itemSchema = z.object({
  code: z.string().max(60).optional(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().max(20).optional(),
  unit_price_cents: z.number().int().min(0).default(0),
  discount_cents: z.number().int().min(0).default(0),
  discount_pct: z.number().min(0).max(100).optional(),
  position: z.number().int().min(0).optional(),
});

// =====================================================================
// HELPERS
// =====================================================================
async function logEvent(
  documentId: number, tenantId: number, eventType: string,
  payload: any, actorId?: number, actorName?: string,
) {
  await db.query(
    `INSERT INTO document_events (document_id, tenant_id, event_type, payload, actor_id, actor_name)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [documentId, tenantId, eventType, JSON.stringify(payload ?? {}), actorId ?? null, actorName ?? null],
  );
}

// =====================================================================
// ROUTES
// =====================================================================
export async function documentsRoutes(app: FastifyInstance) {

  // ==================================================================
  // TEMPLATES
  // ==================================================================
  app.get("/templates", { preHandler: requireTenant }, async (req) => {
    const type = (req.query as any).type;
    const conds = ["tenant_id = $1", "archived = FALSE"];
    const params: any[] = [req.tenantId];
    if (type) { conds.push("type = $2"); params.push(type); }
    const r = await db.query(
      `SELECT * FROM document_templates WHERE ${conds.join(" AND ")}
        ORDER BY is_default DESC, name ASC`,
      params,
    );
    return { items: r.rows };
  });

  app.post("/templates", { preHandler: requireRole("owner", "admin", "super_admin") }, async (req, reply) => {
    const data = templateSchema.parse(req.body);
    if (data.is_default) {
      await db.query(
        `UPDATE document_templates SET is_default = FALSE
          WHERE tenant_id = $1 AND type = $2`,
        [req.tenantId, data.type],
      );
    }
    const r = await db.query(
      `INSERT INTO document_templates
        (tenant_id, name, type, is_default, header_html, body_html, footer_html, css_style,
         default_terms, default_validity_days, default_payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.tenantId, data.name, data.type, data.is_default,
        data.header_html ?? null, data.body_html, data.footer_html ?? null,
        data.css_style ?? null, data.default_terms ?? null,
        data.default_validity_days, data.default_payment_terms ?? null,
      ],
    );
    return reply.code(201).send(r.rows[0]);
  });

  app.put("/templates/:id", { preHandler: requireRole("owner", "admin", "super_admin") }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = templateSchema.partial().parse(req.body);

    if (data.is_default === true) {
      const type = data.type ??
        (await db.query(`SELECT type FROM document_templates WHERE id = $1`, [id])).rows[0]?.type;
      if (type) {
        await db.query(
          `UPDATE document_templates SET is_default = FALSE
            WHERE tenant_id = $1 AND type = $2 AND id != $3`,
          [req.tenantId, type, id],
        );
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    fields.push(`updated_at = NOW()`);
    values.push(id, req.tenantId);

    const r = await db.query(
      `UPDATE document_templates SET ${fields.join(", ")}
        WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "template não encontrado" });
    return r.rows[0];
  });

  app.delete("/templates/:id", { preHandler: requireRole("owner", "admin", "super_admin") }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE document_templates SET archived = TRUE, is_default = FALSE, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "template não encontrado" });
    return { ok: true };
  });

  // ==================================================================
  // DOCUMENTS
  // ==================================================================
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const q = req.query as any;
    const conds = ["d.tenant_id = $1"];
    const params: any[] = [req.tenantId];
    let i = 2;
    if (q.card_id)      { conds.push(`d.card_id = $${i++}`); params.push(Number(q.card_id)); }
    if (q.conversation_id) { conds.push(`d.conversation_id = $${i++}`); params.push(Number(q.conversation_id)); }
    if (q.status)       { conds.push(`d.status = $${i++}`); params.push(q.status); }
    if (q.type)         { conds.push(`d.type = $${i++}`); params.push(q.type); }
    if (q.search)       {
      conds.push(`(d.client_name ILIKE $${i} OR CAST(d.number AS TEXT) LIKE $${i})`);
      params.push(`%${q.search}%`); i++;
    }
    const limit = Math.min(Number(q.limit ?? 100), 500);
    params.push(limit);

    const r = await db.query(
      `SELECT d.*, u.name AS created_by_name,
              (SELECT COUNT(*)::int FROM document_items i WHERE i.document_id = d.id) AS items_count
         FROM documents d
         LEFT JOIN admin_users u ON u.id = d.created_by
        WHERE ${conds.join(" AND ")}
        ORDER BY d.created_at DESC
        LIMIT $${i}`,
      params,
    );
    return { items: r.rows };
  });

  app.get("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const docRes = await db.query(
      `SELECT d.*, u.name AS created_by_name,
              t.name AS template_name
         FROM documents d
         LEFT JOIN admin_users u ON u.id = d.created_by
         LEFT JOIN document_templates t ON t.id = d.template_id
        WHERE d.id = $1 AND d.tenant_id = $2`,
      [id, req.tenantId],
    );
    if (docRes.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });

    const items = await db.query(
      `SELECT * FROM document_items WHERE document_id = $1 ORDER BY position ASC, id ASC`,
      [id],
    );
    const events = await db.query(
      `SELECT * FROM document_events WHERE document_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id],
    );
    return { ...docRes.rows[0], items: items.rows, events: events.rows };
  });

  app.post("/", { preHandler: requireTenant }, async (req, reply) => {
    const data = documentCreateSchema.parse(req.body);

    // Se template não passou, pega o default do tipo
    let templateId = data.template_id;
    let tplRow: any = null;
    if (templateId) {
      const t = await db.query(
        `SELECT * FROM document_templates WHERE id = $1 AND tenant_id = $2 AND archived = FALSE`,
        [templateId, req.tenantId],
      );
      if (t.rowCount === 0) return reply.code(400).send({ error: "template não encontrado" });
      tplRow = t.rows[0];
    } else {
      const t = await db.query(
        `SELECT * FROM document_templates
          WHERE tenant_id = $1 AND type = $2 AND is_default = TRUE AND archived = FALSE
          LIMIT 1`,
        [req.tenantId, data.type],
      );
      tplRow = t.rows[0] ?? null;
      templateId = tplRow?.id ?? null;
    }

    const numberRes = await db.query(
      `SELECT next_document_number($1, $2) AS n`,
      [req.tenantId, data.type],
    );
    const number = numberRes.rows[0].n;

    const validityDays = data.validity_days ?? tplRow?.default_validity_days ?? 15;
    const expiresAt = data.type === "quote"
      ? new Date(Date.now() + validityDays * 86400 * 1000).toISOString()
      : null;

    const r = await db.query(
      `INSERT INTO documents
         (tenant_id, card_id, conversation_id, template_id, number, type, revision,
          client_name, client_document, client_email, client_phone, client_address,
          terms, payment_terms, validity_days, expires_at, notes,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,1,
               $7,$8,$9,$10,$11,
               $12,$13,$14,$15,$16,
               'draft',$17)
       RETURNING *`,
      [
        req.tenantId, data.card_id ?? null, data.conversation_id ?? null, templateId, number, data.type,
        data.client_name, data.client_document ?? null, data.client_email ?? null,
        data.client_phone ?? null, data.client_address ?? null,
        data.terms ?? tplRow?.default_terms ?? null,
        data.payment_terms ?? tplRow?.default_payment_terms ?? null,
        validityDays, expiresAt, data.notes ?? null,
        req.user.sub,
      ],
    );

    await logEvent(r.rows[0].id, req.tenantId!, "created", {
      type: data.type, number, template_id: templateId,
    }, req.user.sub);

    return reply.code(201).send(r.rows[0]);
  });

  app.put("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = documentUpdateSchema.parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    fields.push(`updated_at = NOW()`);
    values.push(id, req.tenantId);

    const r = await db.query(
      `UPDATE documents SET ${fields.join(", ")}
        WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });

    await logEvent(id, req.tenantId!, "edited", data, req.user.sub);
    return r.rows[0];
  });

  app.delete("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE documents SET status = 'canceled', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('approved', 'signed')
        RETURNING id`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "não é possível cancelar (já aprovado/assinado ou inexistente)" });
    await logEvent(id, req.tenantId!, "canceled", null, req.user.sub);
    return { ok: true };
  });

  // ==================================================================
  // ITENS
  // ==================================================================
  app.post("/:id/items", { preHandler: requireTenant }, async (req, reply) => {
    const documentId = Number((req.params as any).id);
    const data = itemSchema.parse(req.body);

    const ok = await db.query(
      `SELECT id FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, req.tenantId],
    );
    if (ok.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });

    // Posição = próxima
    const posRes = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM document_items WHERE document_id = $1`,
      [documentId],
    );
    const position = data.position ?? posRes.rows[0].p;

    const r = await db.query(
      `INSERT INTO document_items
         (document_id, position, code, description, quantity, unit,
          unit_price_cents, discount_cents, discount_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        documentId, position, data.code ?? null, data.description,
        data.quantity, data.unit ?? null,
        data.unit_price_cents, data.discount_cents,
        data.discount_pct ?? null,
      ],
    );

    // Recalcula totais do documento
    await db.query(`SELECT recalculate_document_totals($1)`, [documentId]);
    await logEvent(documentId, req.tenantId!, "items_updated", { action: "added", item_id: r.rows[0].id }, req.user.sub);
    return reply.code(201).send(r.rows[0]);
  });

  app.put("/:id/items/:itemId", { preHandler: requireTenant }, async (req, reply) => {
    const documentId = Number((req.params as any).id);
    const itemId = Number((req.params as any).itemId);
    const data = itemSchema.partial().parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    values.push(itemId, documentId, req.tenantId);

    const r = await db.query(
      `UPDATE document_items SET ${fields.join(", ")}
        WHERE id = $${i++} AND document_id = $${i++}
          AND document_id IN (SELECT id FROM documents WHERE tenant_id = $${i++})
        RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "item não encontrado" });

    await db.query(`SELECT recalculate_document_totals($1)`, [documentId]);
    return r.rows[0];
  });

  app.delete("/:id/items/:itemId", { preHandler: requireTenant }, async (req, reply) => {
    const documentId = Number((req.params as any).id);
    const itemId = Number((req.params as any).itemId);
    const r = await db.query(
      `DELETE FROM document_items
        WHERE id = $1 AND document_id = $2
          AND document_id IN (SELECT id FROM documents WHERE tenant_id = $3)
        RETURNING id`,
      [itemId, documentId, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "item não encontrado" });
    await db.query(`SELECT recalculate_document_totals($1)`, [documentId]);
    return { ok: true };
  });

  // ==================================================================
  // AÇÕES
  // ==================================================================

  // Baixar PDF
  app.get("/:id/pdf", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const ok = await db.query(
      `SELECT id, number, type FROM documents WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId],
    );
    if (ok.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });

    try {
      const pdf = await generateDocumentPdf(id);
      await db.query(
        `UPDATE documents SET pdf_generated_at = NOW() WHERE id = $1`,
        [id],
      );
      await logEvent(id, req.tenantId!, "pdf_generated", null, req.user.sub);

      const filename = `${ok.rows[0].type === "contract" ? "contrato" : "orcamento"}-${String(ok.rows[0].number).padStart(4, "0")}.pdf`;
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `inline; filename="${filename}"`);
      return reply.send(pdf);
    } catch (err: any) {
      req.log.error({ err }, "Erro gerando PDF");
      return reply.code(500).send({ error: "Falha ao gerar PDF: " + err.message });
    }
  });

  // Enviar por WhatsApp (via wppconnect)
  app.post("/:id/send-whatsapp", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const { phone, message } = z.object({
      phone: z.string().optional(),
      message: z.string().optional(),
    }).parse(req.body ?? {});

    const docRes = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId],
    );
    if (docRes.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });
    const doc = docRes.rows[0];

    const targetPhone = phone ?? doc.client_phone;
    if (!targetPhone) return reply.code(400).send({ error: "telefone do cliente não definido" });

    const cleanPhone = String(targetPhone).replace(/\D/g, "");
    if (cleanPhone.length < 10) return reply.code(400).send({ error: "telefone inválido" });

    const docLabel = doc.type === "contract" ? "contrato" : "orçamento";
    const defaultMsg = `Olá ${doc.client_name ?? ""}! Segue o ${docLabel} #${String(doc.number).padStart(4, "0")} conforme conversamos.`;
    const finalMsg = message ?? defaultMsg;

    try {
      // Gera PDF
      const pdf = await generateDocumentPdf(id);
      const pdfBase64 = pdf.toString("base64");
      const filename = `${docLabel}-${String(doc.number).padStart(4, "0")}.pdf`;

      // Envia via WPP-Connect
      if (config.WHATSAPP_PROVIDER === "wppconnect") {
        // 1) Texto
        await axios.post(
          `${config.WPPCONNECT_BASE_URL}/api/${config.WPPCONNECT_SESSION}/send-message`,
          { phone: cleanPhone, message: finalMsg },
          { headers: { Authorization: `Bearer ${config.WPPCONNECT_SESSION_TOKEN}` } },
        );
        // 2) PDF como base64
        await axios.post(
          `${config.WPPCONNECT_BASE_URL}/api/${config.WPPCONNECT_SESSION}/send-file-base64`,
          {
            phone: cleanPhone,
            base64: `data:application/pdf;base64,${pdfBase64}`,
            filename,
            caption: `${docLabel.charAt(0).toUpperCase() + docLabel.slice(1)} #${String(doc.number).padStart(4, "0")}`,
          },
          { headers: { Authorization: `Bearer ${config.WPPCONNECT_SESSION_TOKEN}` } },
        );
      } else {
        return reply.code(501).send({ error: `Envio via WhatsApp não implementado para provider ${config.WHATSAPP_PROVIDER}` });
      }

      // Marca como enviado
      await db.query(
        `UPDATE documents SET status = 'sent', sent_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status IN ('draft', 'sent')`,
        [id],
      );
      await logEvent(id, req.tenantId!, "sent_whatsapp", { phone: cleanPhone, message: finalMsg }, req.user.sub);

      return { ok: true, sent_to: cleanPhone };
    } catch (err: any) {
      req.log.error({ err: err.message }, "Erro enviando WhatsApp");
      return reply.code(500).send({ error: "Falha no envio: " + err.message });
    }
  });

  // Marca como aprovado
  app.post("/:id/approve", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE documents SET status = 'approved', approved_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'sent', 'viewed', 'rejected')
        RETURNING *`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "não é possível aprovar" });
    await logEvent(id, req.tenantId!, "approved", null, req.user.sub);
    return r.rows[0];
  });

  // Marca como rejeitado
  app.post("/:id/reject", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
    const r = await db.query(
      `UPDATE documents SET status = 'rejected', rejected_at = NOW(), rejected_reason = $3, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'sent', 'viewed')
        RETURNING *`,
      [id, req.tenantId, reason ?? null],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "não é possível rejeitar" });
    await logEvent(id, req.tenantId!, "rejected", { reason }, req.user.sub);
    return r.rows[0];
  });

  // Cria nova revisão (clona documento com número novo mas parent_id apontando)
  app.post("/:id/revision", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const oldRes = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId],
    );
    if (oldRes.rowCount === 0) return reply.code(404).send({ error: "documento não encontrado" });
    const old = oldRes.rows[0];

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const newDoc = await client.query(
        `INSERT INTO documents
           (tenant_id, card_id, conversation_id, template_id, number, type, revision,
            parent_document_id, client_name, client_document, client_email, client_phone, client_address,
            terms, payment_terms, validity_days, expires_at, notes,
            status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                 $9,$10,$11,$12,$13,
                 $14,$15,$16,$17,$18,
                 'draft',$19)
         RETURNING *`,
        [
          old.tenant_id, old.card_id, old.conversation_id, old.template_id,
          old.number, old.type, old.revision + 1, old.id,
          old.client_name, old.client_document, old.client_email, old.client_phone, old.client_address,
          old.terms, old.payment_terms, old.validity_days,
          old.type === "quote" ? new Date(Date.now() + (old.validity_days ?? 15) * 86400 * 1000) : null,
          old.notes,
          req.user.sub,
        ],
      );
      // Clona itens
      await client.query(
        `INSERT INTO document_items
           (document_id, position, code, description, quantity, unit,
            unit_price_cents, discount_cents, discount_pct)
         SELECT $1, position, code, description, quantity, unit,
                unit_price_cents, discount_cents, discount_pct
           FROM document_items WHERE document_id = $2`,
        [newDoc.rows[0].id, old.id],
      );
      await client.query(`SELECT recalculate_document_totals($1)`, [newDoc.rows[0].id]);
      await client.query(
        `INSERT INTO document_events (document_id, tenant_id, event_type, payload, actor_id)
         VALUES ($1, $2, 'revision_created', $3, $4)`,
        [newDoc.rows[0].id, req.tenantId, JSON.stringify({ from_document: old.id, from_revision: old.revision }), req.user.sub],
      );
      await client.query("COMMIT");
      return reply.code(201).send(newDoc.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // Converte orçamento aprovado em contrato
  app.post("/:id/convert", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const quoteRes = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2 AND type = 'quote' AND status = 'approved'`,
      [id, req.tenantId],
    );
    if (quoteRes.rowCount === 0) return reply.code(400).send({ error: "só é possível converter orçamentos aprovados" });
    const quote = quoteRes.rows[0];

    // Pega template default de contrato
    const tplRes = await db.query(
      `SELECT id FROM document_templates
        WHERE tenant_id = $1 AND type = 'contract' AND is_default = TRUE AND archived = FALSE
        LIMIT 1`,
      [req.tenantId],
    );
    const contractTemplateId = tplRes.rows[0]?.id ?? null;

    const numberRes = await db.query(`SELECT next_document_number($1, 'contract') AS n`, [req.tenantId]);
    const contractNumber = numberRes.rows[0].n;

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const contract = await client.query(
        `INSERT INTO documents
           (tenant_id, card_id, conversation_id, template_id, number, type, revision,
            parent_document_id, client_name, client_document, client_email, client_phone, client_address,
            terms, payment_terms,
            subtotal_cents, discount_cents, tax_cents, total_cents,
            status, created_by, notes)
         VALUES ($1,$2,$3,$4,$5,'contract',1,$6,
                 $7,$8,$9,$10,$11,
                 $12,$13,
                 $14,$15,$16,$17,
                 'draft',$18,$19)
         RETURNING *`,
        [
          quote.tenant_id, quote.card_id, quote.conversation_id, contractTemplateId, contractNumber, quote.id,
          quote.client_name, quote.client_document, quote.client_email, quote.client_phone, quote.client_address,
          quote.terms, quote.payment_terms,
          quote.subtotal_cents, quote.discount_cents, quote.tax_cents, quote.total_cents,
          req.user.sub, `Convertido do orçamento #${String(quote.number).padStart(4, "0")}`,
        ],
      );
      // Clona itens
      await client.query(
        `INSERT INTO document_items
           (document_id, position, code, description, quantity, unit,
            unit_price_cents, discount_cents, discount_pct)
         SELECT $1, position, code, description, quantity, unit,
                unit_price_cents, discount_cents, discount_pct
           FROM document_items WHERE document_id = $2`,
        [contract.rows[0].id, quote.id],
      );
      // Marca orçamento como convertido
      await client.query(
        `UPDATE documents SET status = 'converted', updated_at = NOW() WHERE id = $1`,
        [quote.id],
      );
      await client.query(
        `INSERT INTO document_events (document_id, tenant_id, event_type, payload, actor_id)
         VALUES ($1, $2, 'converted_to_contract', $3, $4)`,
        [quote.id, req.tenantId, JSON.stringify({ contract_id: contract.rows[0].id }), req.user.sub],
      );
      await client.query("COMMIT");
      return reply.code(201).send(contract.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}
