import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireSuperAdmin } from "../../lib/auth";

/**
 * Endpoints de super-admin para gerenciar TODOS os tenants.
 * Visíveis só pra role 'super_admin'.
 */
export async function tenantsRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Overview: KPIs do SaaS inteiro
  // -----------------------------------------------------------------
  app.get("/overview", { preHandler: requireSuperAdmin }, async () => {
    const [tenants, signups, conversations, messages, mrr] = await Promise.all([
      db.query(`SELECT
                  COUNT(*)::int FILTER (WHERE status = 'active') AS active,
                  COUNT(*)::int FILTER (WHERE plan = 'trial')    AS trial,
                  COUNT(*)::int FILTER (WHERE status = 'suspended') AS suspended,
                  COUNT(*)::int AS total
                FROM tenants`),
      db.query(`SELECT COUNT(*)::int AS n FROM tenants
                 WHERE created_at >= NOW() - INTERVAL '30 days'`),
      db.query(`SELECT COUNT(*)::int AS n FROM conversations
                 WHERE last_message_at >= NOW() - INTERVAL '30 days'`),
      db.query(`SELECT COUNT(*)::int AS n FROM messages
                 WHERE sent_at >= NOW() - INTERVAL '30 days'`),
      db.query(`SELECT COALESCE(SUM(p.price_monthly_cents), 0)::bigint AS cents
                  FROM tenants t JOIN plans p ON p.slug = t.plan
                 WHERE t.status = 'active' AND t.plan != 'trial'`),
    ]);

    return {
      tenants_total: tenants.rows[0].total,
      tenants_active: tenants.rows[0].active,
      tenants_trial: tenants.rows[0].trial,
      tenants_suspended: tenants.rows[0].suspended,
      mrr_cents: Number(mrr.rows[0].cents),
      signups_last_30d: signups.rows[0].n,
      conversations_last_30d: conversations.rows[0].n,
      messages_last_30d: messages.rows[0].n,
    };
  });

  // -----------------------------------------------------------------
  // Lista de tenants
  // -----------------------------------------------------------------
  app.get("/", { preHandler: requireSuperAdmin }, async (req) => {
    const q = z.object({
      status: z.enum(["active", "suspended", "canceled", "all"]).default("all"),
      plan: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().default(100),
    }).parse(req.query);

    const where: string[] = ["1=1"];
    const params: any[] = [];
    if (q.status !== "all") { params.push(q.status); where.push(`status = $${params.length}`); }
    if (q.plan)             { params.push(q.plan);   where.push(`plan = $${params.length}`); }
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(name ILIKE $${params.length} OR slug ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    params.push(q.limit);

    const r = await db.query(
      `SELECT id, slug, name, email, plan, status, trial_ends_at, created_at,
              (SELECT COUNT(*)::int FROM admin_users WHERE tenant_id = t.id) AS users_count
         FROM tenants t
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return r.rows;
  });

  // -----------------------------------------------------------------
  // Detalhe de tenant
  // -----------------------------------------------------------------
  app.get("/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(`SELECT * FROM tenants WHERE id = $1`, [id]);
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });

    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM admin_users WHERE tenant_id = $1) AS users,
        (SELECT COUNT(*)::int FROM contacts WHERE tenant_id = $1) AS contacts,
        (SELECT COUNT(*)::int FROM conversations WHERE tenant_id = $1) AS conversations,
        (SELECT COUNT(*)::int FROM messages WHERE tenant_id = $1) AS messages,
        (SELECT COUNT(*)::int FROM leads WHERE tenant_id = $1) AS leads,
        (SELECT COUNT(*)::int FROM whatsapp_instances WHERE tenant_id = $1 AND status = 'connected') AS active_instances
    `, [id]);

    return { ...r.rows[0], stats: stats.rows[0] };
  });

  // -----------------------------------------------------------------
  // Atualizar plano / status
  // -----------------------------------------------------------------
  app.patch("/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      plan: z.enum(["trial", "starter", "pro", "enterprise"]).optional(),
      status: z.enum(["active", "suspended", "canceled"]).optional(),
      trial_ends_at: z.string().datetime().nullable().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.plan)   { params.push(body.plan);   sets.push(`plan = $${params.length}`); }
    if (body.status) { params.push(body.status); sets.push(`status = $${params.length}`); }
    if (body.trial_ends_at !== undefined) {
      params.push(body.trial_ends_at);
      sets.push(`trial_ends_at = $${params.length}`);
    }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const r = await db.query(
      `UPDATE tenants SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return r.rows[0];
  });

  // -----------------------------------------------------------------
  // Listar planos disponíveis
  // -----------------------------------------------------------------
  app.get("/_meta/plans", { preHandler: requireSuperAdmin }, async () => {
    const r = await db.query(`SELECT * FROM plans WHERE active = TRUE ORDER BY position`);
    return r.rows;
  });
}
