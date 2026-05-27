import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";
import { requireCampaignsFeature } from "../../lib/plan-guard";
import { renderTemplate } from "./templates.routes";

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    await requireTenant(req, reply);
    if (reply.sent) return;
    try { await requireCampaignsFeature(req.tenantId!); }
    catch (err: any) { return reply.code(err.statusCode ?? 403).send({ error: err.message }); }
  });

  // ---------------------------------------------------------------
  // GET /campaigns — lista
  // ---------------------------------------------------------------
  app.get("/", async (req) => {
    const q = z.object({
      status: z.string().optional(),
      limit: z.coerce.number().default(50),
    }).parse(req.query);

    const where: string[] = ["tenant_id = $1"];
    const params: any[] = [req.tenantId!];
    if (q.status) { params.push(q.status); where.push(`status = $${params.length}`); }
    params.push(q.limit);

    const r = await db.query(
      `SELECT id, name, provider, status, total_count, sent_count, delivered_count,
              read_count, failed_count, opted_out_count, scheduled_at, started_at,
              completed_at, created_at
         FROM campaigns WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return r.rows;
  });

  // ---------------------------------------------------------------
  // POST /campaigns — cria campanha (status draft)
  // ---------------------------------------------------------------
  app.post("/", async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120),
      provider: z.enum(["wppconnect", "meta_cloud", "evolution", "ultramsg"]).default("wppconnect"),
      instance_id: z.number().optional(),
      list_id: z.number(),
      template_id: z.number().optional(),
      custom_body: z.string().max(4096).optional(),
      media_type: z.enum(["image", "video", "document"]).optional(),
      media_url: z.string().url().optional(),
      scheduled_at: z.string().datetime().optional(),
      rate_per_min: z.number().min(1).max(60).default(10),
      jitter_seconds: z.number().min(0).max(60).default(5),
      filters: z.object({
        only_opted_in: z.boolean().default(true),
        exclude_opted_out: z.boolean().default(true),
      }).default({ only_opted_in: true, exclude_opted_out: true }),
    }).parse(req.body);

    if (!body.template_id && !body.custom_body) {
      return reply.code(400).send({ error: "informe template_id OU custom_body" });
    }

    // Verifica que list pertence ao tenant
    const list = await db.query(
      `SELECT id FROM contact_lists WHERE id = $1 AND tenant_id = $2`,
      [body.list_id, req.tenantId!],
    );
    if (list.rowCount === 0) return reply.code(400).send({ error: "lista não pertence ao tenant" });

    const r = await db.query(
      `INSERT INTO campaigns
        (tenant_id, name, provider, instance_id, list_id, template_id, custom_body,
         media_type, media_url, scheduled_at, rate_per_min, jitter_seconds, filters, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
       RETURNING *`,
      [
        req.tenantId!, body.name, body.provider, body.instance_id ?? null, body.list_id,
        body.template_id ?? null, body.custom_body ?? null, body.media_type ?? null, body.media_url ?? null,
        body.scheduled_at ?? null, body.rate_per_min, body.jitter_seconds,
        JSON.stringify(body.filters), req.user.sub,
      ],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // ---------------------------------------------------------------
  // GET /campaigns/:id — detalhe
  // ---------------------------------------------------------------
  app.get("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT c.*, cl.name AS list_name, t.name AS template_name
         FROM campaigns c
    LEFT JOIN contact_lists cl     ON cl.id = c.list_id
    LEFT JOIN message_templates t  ON t.id = c.template_id
        WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  // ---------------------------------------------------------------
  // GET /campaigns/:id/recipients — lista destinatários
  // ---------------------------------------------------------------
  app.get("/:id/recipients", async (req) => {
    const id = Number((req.params as any).id);
    const q = z.object({
      status: z.string().optional(),
      limit: z.coerce.number().default(100),
      offset: z.coerce.number().default(0),
    }).parse(req.query);

    const where: string[] = ["tenant_id = $1", "campaign_id = $2"];
    const params: any[] = [req.tenantId!, id];
    if (q.status) { params.push(q.status); where.push(`status = $${params.length}`); }
    params.push(q.limit, q.offset);

    const r = await db.query(
      `SELECT id, phone, name, status, sent_at, delivered_at, read_at, failed_reason
         FROM campaign_recipients
        WHERE ${where.join(" AND ")}
        ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return r.rows;
  });

  // ---------------------------------------------------------------
  // POST /campaigns/:id/prepare
  //   Materializa os destinatários (snapshot da lista + renderiza body)
  //   Status passa de draft → scheduled (ou running se sem schedule)
  // ---------------------------------------------------------------
  app.post("/:id/prepare", async (req, reply) => {
    const id = Number((req.params as any).id);
    const camp = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (camp.rowCount === 0) return reply.code(404).send({ error: "campanha não encontrada" });
    const c = camp.rows[0];
    if (c.status !== "draft") {
      return reply.code(400).send({ error: `campanha em status ${c.status}, não pode preparar` });
    }

    // Carrega template body (se houver)
    let templateBody = c.custom_body ?? "";
    if (c.template_id) {
      const t = await db.query(`SELECT body FROM message_templates WHERE id = $1 AND tenant_id = $2`,
        [c.template_id, req.tenantId!]);
      if (t.rowCount === 0) return reply.code(400).send({ error: "template não encontrado" });
      templateBody = t.rows[0].body;
    }

    // Filtros
    const filters = c.filters ?? {};
    const where: string[] = ["tenant_id = $1", "list_id = $2", "phone_valid = TRUE"];
    if (filters.only_opted_in)    where.push("opted_in = TRUE");
    if (filters.exclude_opted_out) where.push("opted_out = FALSE");

    // Carrega contatos
    const contacts = await db.query(
      `SELECT id, phone, name, variables
         FROM contact_list_items WHERE ${where.join(" AND ")}`,
      [req.tenantId!, c.list_id],
    );

    if (contacts.rowCount === 0) {
      return reply.code(400).send({ error: "lista sem destinatários após filtros" });
    }

    // Inserir destinatários (com body renderizado)
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Remove destinatários anteriores (re-prepare)
      await client.query(`DELETE FROM campaign_recipients WHERE campaign_id = $1`, [id]);

      let count = 0;
      for (const item of contacts.rows) {
        const vars = { ...(item.variables ?? {}), nome: item.name ?? "", phone: item.phone };
        const rendered = renderTemplate(templateBody, vars);
        await client.query(
          `INSERT INTO campaign_recipients
            (tenant_id, campaign_id, contact_item_id, phone, name, variables, rendered_body)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.tenantId!, id, item.id, item.phone, item.name, JSON.stringify(vars), rendered],
        );
        count++;
      }

      await client.query(
        `UPDATE campaigns
            SET total_count = $2,
                status = CASE WHEN scheduled_at IS NULL THEN 'running' ELSE 'scheduled' END,
                updated_at = NOW()
          WHERE id = $1`,
        [id, count],
      );
      await client.query("COMMIT");
      return { ok: true, total_recipients: count };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // ---------------------------------------------------------------
  // POST /campaigns/:id/pause
  // ---------------------------------------------------------------
  app.post("/:id/pause", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE campaigns SET status = 'paused', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status IN ('running','scheduled')
        RETURNING status`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "campanha não pode ser pausada" });
    return { ok: true, status: r.rows[0].status };
  });

  app.post("/:id/resume", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE campaigns SET status = 'running', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'paused'
        RETURNING status`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "campanha não está pausada" });
    return { ok: true, status: r.rows[0].status };
  });

  app.post("/:id/cancel", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE campaigns SET status = 'canceled', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('completed','canceled')
        RETURNING status`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "campanha não pode ser cancelada" });
    return { ok: true, status: r.rows[0].status };
  });

  app.delete("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('running','scheduled')`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(400).send({ error: "campanha não pode ser deletada (ativa)" });
    return { ok: true };
  });
}
