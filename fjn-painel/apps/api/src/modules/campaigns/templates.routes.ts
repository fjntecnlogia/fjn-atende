import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";
import { requireCampaignsFeature } from "../../lib/plan-guard";

export async function templatesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    await requireTenant(req, reply);
    if (reply.sent) return;
    try { await requireCampaignsFeature(req.tenantId!); }
    catch (err: any) { return reply.code(err.statusCode ?? 403).send({ error: err.message }); }
  });

  // Lista
  app.get("/", async (req) => {
    const r = await db.query(
      `SELECT id, name, category, body, media_type, media_url,
              meta_template_name, meta_template_status, meta_language, updated_at
         FROM message_templates WHERE tenant_id = $1 ORDER BY name`,
      [req.tenantId!],
    );
    return r.rows;
  });

  app.post("/", async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120),
      category: z.enum(["marketing", "authentication", "utility"]).default("marketing"),
      body: z.string().min(1).max(4096),
      media_type: z.enum(["image", "video", "document"]).optional(),
      media_url: z.string().url().optional(),
    }).parse(req.body);

    const r = await db.query(
      `INSERT INTO message_templates
        (tenant_id, name, category, body, media_type, media_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.tenantId!, body.name, body.category, body.body, body.media_type ?? null, body.media_url ?? null],
    );
    return reply.code(201).send(r.rows[0]);
  });

  app.get("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT * FROM message_templates WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  app.put("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      category: z.enum(["marketing", "authentication", "utility"]).optional(),
      body: z.string().min(1).max(4096).optional(),
      media_type: z.enum(["image", "video", "document"]).nullable().optional(),
      media_url: z.string().url().nullable().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
    if (sets.length === 0) return { ok: true };
    sets.push("updated_at = NOW()");
    params.push(id, req.tenantId!);
    const r = await db.query(
      `UPDATE message_templates SET ${sets.join(", ")}
        WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  app.delete("/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `DELETE FROM message_templates WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return { ok: true };
  });

  /**
   * POST /templates/preview
   * Renderiza body com variáveis de teste pra ver como fica.
   * Body: { body, variables: {nome:"Fagner", empresa:"FJN"} }
   */
  app.post("/preview", async (req) => {
    const body = z.object({
      body: z.string().min(1).max(4096),
      variables: z.record(z.string()).default({}),
    }).parse(req.body);

    return { rendered: renderTemplate(body.body, body.variables) };
  });
}

/**
 * Renderiza template com variáveis {{nome}} → Fagner
 * - Suporta {{nome}} e {{nome|fallback}}
 * - Suporta {{nome|capitalize}} e {{nome|upper}} e {{nome|first}}
 */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([\w_-]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g, (_, key, modifier) => {
    let val = vars[key.toLowerCase()] ?? "";

    if (modifier) {
      const mod = modifier.trim();
      if (val === "" && !["capitalize", "upper", "lower", "first"].includes(mod)) {
        // tratado como fallback
        return mod;
      }
      switch (mod.toLowerCase()) {
        case "upper":      val = val.toUpperCase(); break;
        case "lower":      val = val.toLowerCase(); break;
        case "capitalize": val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(); break;
        case "first":      val = val.split(/\s+/)[0]; break;
      }
    }
    return val;
  });
}
