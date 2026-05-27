import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";
import { requireCampaignsFeature, getTenantPlan } from "../../lib/plan-guard";

/**
 * CRUD de listas de contatos.
 *
 * Métodos de criação:
 *  - POST /contact-lists                 — cria lista vazia
 *  - POST /contact-lists/:id/items       — adiciona contato manual
 *  - POST /contact-lists/:id/import-csv  — sobe CSV (multipart)
 *  - POST /contact-lists/:id/import-from-atendimento — importa contatos que já conversaram
 */

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Adiciona DDI BR se vier sem (10/11 dígitos)
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith("55")) {
    return "55" + digits;
  }
  return digits;
}

function parseCsvText(text: string): { phone: string; name?: string; vars: Record<string,string> }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detecta separador (`,` ou `;`)
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

  const phoneIdx = headers.findIndex((h) => /^(phone|telefone|celular|whatsapp|fone|numero|número)$/i.test(h));
  const nameIdx  = headers.findIndex((h) => /^(name|nome|cliente|contato)$/i.test(h));
  if (phoneIdx === -1) return [];

  const out: { phone: string; name?: string; vars: Record<string,string> }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const phone = normalizePhone(cols[phoneIdx] ?? "");
    if (phone.length < 12) continue;

    const name = nameIdx >= 0 ? (cols[nameIdx] || undefined) : undefined;

    // Variáveis customizadas = todas as colunas exceto phone/name
    const vars: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (idx === phoneIdx || idx === nameIdx) return;
      if (cols[idx]) vars[h] = cols[idx];
    });

    out.push({ phone, name, vars });
  }
  return out;
}

export async function contactListsRoutes(app: FastifyInstance) {
  // Middleware: todos os endpoints requerem campanhas habilitadas
  app.addHook("preHandler", async (req, reply) => {
    await requireTenant(req, reply);
    if (reply.sent) return;
    try {
      await requireCampaignsFeature(req.tenantId!);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 403).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------
  // GET /contact-lists  — lista
  // ---------------------------------------------------------------
  app.get("/", async (req) => {
    const r = await db.query(
      `SELECT id, name, description, source, total_count, optin_count, optout_count, created_at
         FROM contact_lists WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId!],
    );
    return r.rows;
  });

  // ---------------------------------------------------------------
  // POST /contact-lists — cria lista vazia
  // ---------------------------------------------------------------
  app.post("/", async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(500).optional(),
    }).parse(req.body);

    const r = await db.query(
      `INSERT INTO contact_lists (tenant_id, name, description, source)
       VALUES ($1, $2, $3, 'manual') RETURNING *`,
      [req.tenantId!, body.name, body.description ?? null],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // ---------------------------------------------------------------
  // GET /contact-lists/:id  — detalhe + itens (paginado)
  // ---------------------------------------------------------------
  app.get("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const q = z.object({
      limit: z.coerce.number().default(50),
      offset: z.coerce.number().default(0),
      search: z.string().optional(),
    }).parse(req.query);

    const list = await db.query(
      `SELECT * FROM contact_lists WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (list.rowCount === 0) return reply.code(404).send({ error: "lista não encontrada" });

    const where: string[] = ["tenant_id = $1", "list_id = $2"];
    const params: any[] = [req.tenantId!, id];
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(phone ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    params.push(q.limit, q.offset);
    const items = await db.query(
      `SELECT id, phone, name, email, variables, opted_in, opted_out, opted_out_reason,
              last_message_status, last_message_at
         FROM contact_list_items
        WHERE ${where.join(" AND ")}
        ORDER BY id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { list: list.rows[0], items: items.rows };
  });

  // ---------------------------------------------------------------
  // PATCH /contact-lists/:id  — renomear
  // ---------------------------------------------------------------
  app.patch("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(500).optional(),
    }).parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];
    if (body.name)        { params.push(body.name);        sets.push(`name = $${params.length}`); }
    if (body.description !== undefined) { params.push(body.description); sets.push(`description = $${params.length}`); }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = NOW()`);
    params.push(id, req.tenantId!);
    const r = await db.query(
      `UPDATE contact_lists SET ${sets.join(", ")} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  // ---------------------------------------------------------------
  // DELETE /contact-lists/:id
  // ---------------------------------------------------------------
  app.delete("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `DELETE FROM contact_lists WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return { ok: true };
  });

  // ---------------------------------------------------------------
  // POST /contact-lists/:id/items  — adiciona contatos manualmente
  // Body: { items: [{phone, name?, email?, variables?, opted_in?}, ...] }
  // ---------------------------------------------------------------
  app.post("/:id/items", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      items: z.array(z.object({
        phone: z.string().min(8),
        name: z.string().optional(),
        email: z.string().email().optional(),
        variables: z.record(z.string()).optional(),
        opted_in: z.boolean().default(false),
      })).min(1).max(10000),
    }).parse(req.body);

    // Verifica limite do plano
    const plan = await getTenantPlan(req.tenantId!);
    const listCount = await db.query(
      `SELECT total_count FROM contact_lists WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (listCount.rowCount === 0) return reply.code(404).send({ error: "lista não encontrada" });

    const newTotal = (listCount.rows[0].total_count ?? 0) + body.items.length;
    if (plan && plan.max_contact_list_size > 0 && newTotal > plan.max_contact_list_size) {
      return reply.code(402).send({
        error: `limite do plano excedido: ${newTotal}/${plan.max_contact_list_size} contatos`,
      });
    }

    let inserted = 0, skipped = 0;
    for (const item of body.items) {
      const phone = normalizePhone(item.phone);
      if (phone.length < 12) { skipped++; continue; }
      try {
        const optedIn = item.opted_in;
        await db.query(
          `INSERT INTO contact_list_items
            (tenant_id, list_id, phone, name, email, variables, opted_in, opted_in_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (list_id, phone) DO NOTHING`,
          [
            req.tenantId!, id, phone, item.name ?? null, item.email ?? null,
            JSON.stringify(item.variables ?? {}),
            optedIn, optedIn ? new Date() : null,
          ],
        );
        inserted++;
      } catch (err) {
        skipped++;
      }
    }
    return { inserted, skipped, total_provided: body.items.length };
  });

  // ---------------------------------------------------------------
  // POST /contact-lists/:id/import-csv  — sobe CSV (multipart)
  // ---------------------------------------------------------------
  app.post("/:id/import-csv", async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!req.isMultipart || !req.isMultipart()) {
      return reply.code(400).send({ error: "envie como multipart/form-data" });
    }
    const file = await (req as any).file();
    if (!file) return reply.code(400).send({ error: "arquivo não enviado" });

    const buf = await file.toBuffer();
    const text = buf.toString("utf-8");
    const parsed = parseCsvText(text);
    if (parsed.length === 0) {
      return reply.code(400).send({ error: "CSV vazio ou sem coluna telefone reconhecida" });
    }

    // Insere via INSERT bulk
    let inserted = 0, skipped = 0;
    for (const it of parsed) {
      try {
        const r = await db.query(
          `INSERT INTO contact_list_items
            (tenant_id, list_id, phone, name, variables)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (list_id, phone) DO NOTHING
           RETURNING id`,
          [req.tenantId!, id, it.phone, it.name ?? null, JSON.stringify(it.vars)],
        );
        if ((r.rowCount ?? 0) > 0) inserted++; else skipped++;
      } catch { skipped++; }
    }
    return { inserted, skipped, total_in_csv: parsed.length };
  });

  // ---------------------------------------------------------------
  // POST /contact-lists/:id/import-from-atendimento
  // Importa contatos que já conversaram (já são opt-in)
  // Body: { since_days?: number (padrão 90) }
  // ---------------------------------------------------------------
  app.post("/:id/import-from-atendimento", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      since_days: z.number().min(1).max(3650).default(90),
      only_with_name: z.boolean().default(false),
    }).parse(req.body ?? {});

    const list = await db.query(
      `SELECT id FROM contact_lists WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (list.rowCount === 0) return reply.code(404).send({ error: "lista não encontrada" });

    const where: string[] = ["tenant_id = $1", "last_seen >= NOW() - ($2 || ' days')::interval"];
    if (body.only_with_name) where.push("name IS NOT NULL");

    const r = await db.query(
      `INSERT INTO contact_list_items (tenant_id, list_id, phone, name, opted_in, opted_in_at)
       SELECT $1, $3, phone, name, TRUE, NOW()
         FROM contacts
        WHERE ${where.join(" AND ")}
       ON CONFLICT (list_id, phone) DO NOTHING
       RETURNING id`,
      [req.tenantId!, body.since_days, id],
    );
    return { imported: r.rowCount ?? 0 };
  });

  // ---------------------------------------------------------------
  // PATCH /contact-lists/:id/items/:itemId — opt-in/opt-out manual
  // ---------------------------------------------------------------
  app.patch("/:id/items/:itemId", async (req, reply) => {
    const id = Number((req.params as any).id);
    const itemId = Number((req.params as any).itemId);
    const body = z.object({
      opted_in: z.boolean().optional(),
      opted_out: z.boolean().optional(),
      opted_out_reason: z.string().max(120).optional(),
      name: z.string().optional(),
      variables: z.record(z.string()).optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.opted_in !== undefined) {
      params.push(body.opted_in); sets.push(`opted_in = $${params.length}`);
      sets.push(`opted_in_at = ${body.opted_in ? "NOW()" : "NULL"}`);
    }
    if (body.opted_out !== undefined) {
      params.push(body.opted_out); sets.push(`opted_out = $${params.length}`);
      sets.push(`opted_out_at = ${body.opted_out ? "NOW()" : "NULL"}`);
    }
    if (body.opted_out_reason) {
      params.push(body.opted_out_reason); sets.push(`opted_out_reason = $${params.length}`);
    }
    if (body.name !== undefined) { params.push(body.name); sets.push(`name = $${params.length}`); }
    if (body.variables) {
      params.push(JSON.stringify(body.variables)); sets.push(`variables = $${params.length}::jsonb`);
    }
    if (sets.length === 0) return { ok: true };

    params.push(itemId, id, req.tenantId!);
    const r = await db.query(
      `UPDATE contact_list_items SET ${sets.join(", ")}
        WHERE id = $${params.length - 2} AND list_id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "item não encontrado" });
    return r.rows[0];
  });

  app.delete("/:id/items/:itemId", async (req, reply) => {
    const id = Number((req.params as any).id);
    const itemId = Number((req.params as any).itemId);
    const r = await db.query(
      `DELETE FROM contact_list_items
        WHERE id = $1 AND list_id = $2 AND tenant_id = $3`,
      [itemId, id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return { ok: true };
  });
}
