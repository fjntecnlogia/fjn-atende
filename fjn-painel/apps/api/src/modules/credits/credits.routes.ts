import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant, requireSuperAdmin } from "../../lib/auth";

export async function creditsRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------
  // GET /credits/me — saldo do tenant atual
  // ---------------------------------------------------------------
  app.get("/me", { preHandler: requireTenant }, async (req) => {
    // Garante row em tenant_credits
    await db.query(
      `INSERT INTO tenant_credits (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [req.tenantId!],
    );

    const credits = await db.query(
      `SELECT balance_cents, total_purchased_cents, total_spent_cents,
              auto_recharge, auto_recharge_threshold_cents, auto_recharge_amount_cents
         FROM tenant_credits WHERE tenant_id = $1`,
      [req.tenantId!],
    );

    // Tarifa vigente por provider pro tenant
    const pricing = await db.query(
      `SELECT DISTINCT ON (provider) provider, price_cents
         FROM message_pricing
        WHERE active = TRUE
          AND (tenant_id = $1 OR tenant_id IS NULL)
          AND (valid_until IS NULL OR valid_until > NOW())
        ORDER BY provider, tenant_id NULLS LAST`,
      [req.tenantId!],
    );

    return {
      ...credits.rows[0],
      pricing: pricing.rows,
    };
  });

  // ---------------------------------------------------------------
  // GET /credits/transactions — histórico
  // ---------------------------------------------------------------
  app.get("/transactions", { preHandler: requireTenant }, async (req) => {
    const q = z.object({
      limit: z.coerce.number().default(50),
      kind: z.string().optional(),
    }).parse(req.query);

    const where: string[] = ["tenant_id = $1"];
    const params: any[] = [req.tenantId!];
    if (q.kind) { params.push(q.kind); where.push(`kind = $${params.length}`); }
    params.push(q.limit);

    const r = await db.query(
      `SELECT id, kind, amount_cents, balance_after_cents, description,
              campaign_id, payment_provider, created_at
         FROM credit_transactions WHERE ${where.join(" AND ")}
        ORDER BY id DESC LIMIT $${params.length}`,
      params,
    );
    return r.rows;
  });

  // ---------------------------------------------------------------
  // POST /credits/add  (super-admin OU integração de pagamento)
  // Adiciona crédito manualmente (Pagar.me integration vem depois)
  // ---------------------------------------------------------------
  app.post("/add", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const body = z.object({
      tenant_id: z.number(),
      amount_cents: z.number().int().positive(),
      kind: z.enum(["purchase", "bonus", "refund", "manual"]).default("manual"),
      description: z.string().max(500).optional(),
      payment_provider: z.string().optional(),
      payment_external_id: z.string().optional(),
    }).parse(req.body);

    const r = await db.query(
      `SELECT add_credits($1, $2, $3, $4, $5, $6, $7) AS balance`,
      [
        body.tenant_id,
        body.amount_cents,
        body.kind,
        body.description ?? `Adição manual via super-admin`,
        body.payment_provider ?? null,
        body.payment_external_id ?? null,
        req.user.sub,
      ],
    );
    return { ok: true, new_balance_cents: r.rows[0].balance };
  });

  // ---------------------------------------------------------------
  // POST /credits/me/auto-recharge  — configura recarga automática
  // ---------------------------------------------------------------
  app.post("/me/auto-recharge", { preHandler: requireTenant }, async (req) => {
    const body = z.object({
      enabled: z.boolean(),
      threshold_cents: z.number().int().min(500).default(1000),  // mín R$ 5
      amount_cents: z.number().int().min(2000).default(5000),     // mín R$ 20
    }).parse(req.body);

    await db.query(
      `UPDATE tenant_credits
          SET auto_recharge = $2,
              auto_recharge_threshold_cents = $3,
              auto_recharge_amount_cents = $4,
              updated_at = NOW()
        WHERE tenant_id = $1`,
      [req.tenantId!, body.enabled, body.threshold_cents, body.amount_cents],
    );
    return { ok: true };
  });
}
