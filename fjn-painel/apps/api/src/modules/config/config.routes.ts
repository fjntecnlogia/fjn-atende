import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

/**
 * Configuração da IA por tenant:
 *   - prompt_master (system prompt principal) → tabela tenants
 *   - ai_persona (nome, tom, regras) → tabela tenants (JSONB)
 *   - dossiês de produtos/serviços → tabela tenant_knowledge
 */
export async function configRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Persona e prompt master (config geral da IA)
  // -----------------------------------------------------------------
  app.get("/persona", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT ai_persona, prompt_master FROM tenants WHERE id = $1`,
      [req.tenantId!],
    );
    return r.rows[0];
  });

  app.put("/persona", { preHandler: requireTenant }, async (req) => {
    const body = z.object({
      ai_persona: z.object({
        name: z.string().min(1).max(60).optional(),
        tone: z.string().min(1).max(200).optional(),
        rules: z.array(z.string().max(500)).max(20).optional(),
      }).optional(),
      prompt_master: z.string().max(50_000).nullable().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.ai_persona) {
      params.push(JSON.stringify(body.ai_persona));
      sets.push(`ai_persona = $${params.length}::jsonb`);
    }
    if (body.prompt_master !== undefined) {
      params.push(body.prompt_master);
      sets.push(`prompt_master = $${params.length}`);
    }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = NOW()`);
    params.push(req.tenantId!);
    await db.query(`UPDATE tenants SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    return { ok: true };
  });

  // -----------------------------------------------------------------
  // Dossiês / knowledge base (CRUD)
  // -----------------------------------------------------------------
  app.get("/knowledge", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT id, key, title, content, enabled, position, updated_at
         FROM tenant_knowledge WHERE tenant_id = $1
        ORDER BY position, id`,
      [req.tenantId!],
    );
    return r.rows;
  });

  app.post("/knowledge", { preHandler: requireTenant }, async (req, reply) => {
    const body = z.object({
      key: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/i),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(200_000),
      enabled: z.boolean().default(true),
      position: z.number().int().default(0),
    }).parse(req.body);

    try {
      const r = await db.query(
        `INSERT INTO tenant_knowledge (tenant_id, key, title, content, enabled, position)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.tenantId!, body.key, body.title, body.content, body.enabled, body.position],
      );
      return reply.code(201).send(r.rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return reply.code(409).send({ error: "key já existe" });
      throw err;
    }
  });

  app.put("/knowledge/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).max(200_000).optional(),
      enabled: z.boolean().optional(),
      position: z.number().int().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.title !== undefined)    { params.push(body.title);    sets.push(`title = $${params.length}`); }
    if (body.content !== undefined)  { params.push(body.content);  sets.push(`content = $${params.length}`); }
    if (body.enabled !== undefined)  { params.push(body.enabled);  sets.push(`enabled = $${params.length}`); }
    if (body.position !== undefined) { params.push(body.position); sets.push(`position = $${params.length}`); }
    if (sets.length === 0) return reply.send({ ok: true });

    sets.push("updated_at = NOW()");
    params.push(id, req.tenantId!);
    const r = await db.query(
      `UPDATE tenant_knowledge SET ${sets.join(", ")}
        WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
        RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  app.delete("/knowledge/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `DELETE FROM tenant_knowledge WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return { ok: true };
  });

  // -----------------------------------------------------------------
  // Branding (logo, cores, nome de exibição)
  // -----------------------------------------------------------------
  app.get("/branding", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(`SELECT branding FROM tenants WHERE id = $1`, [req.tenantId!]);
    return r.rows[0]?.branding ?? {};
  });

  app.put("/branding", { preHandler: requireTenant }, async (req) => {
    const body = z.object({
      display_name: z.string().max(120).optional(),
      primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      logo_url: z.string().url().nullable().optional(),
    }).parse(req.body);

    await db.query(
      `UPDATE tenants
          SET branding = branding || $1::jsonb, updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(body), req.tenantId!],
    );
    return { ok: true };
  });
}
