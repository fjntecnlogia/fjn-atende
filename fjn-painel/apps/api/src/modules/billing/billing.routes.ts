/**
 * Rotas de Billing (Stripe Subscriptions).
 *
 *  GET  /plans                 → catálogo público de planos
 *  GET  /billing/subscription  → assinatura atual do tenant
 *  POST /billing/checkout      → cria Stripe Checkout pra assinar
 *  POST /billing/portal        → URL do Customer Portal do Stripe
 *  POST /billing/cancel        → cancela ao fim do período
 *  POST /billing/reactivate    → desfaz cancelamento agendado
 *  POST /billing/change-plan   → mudar de plano (prorate)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { config } from "../../config";
import { requireAuth, requireTenant, requireSuperAdmin } from "../../lib/auth";
import { getStripe, isStripeEnabled } from "../../lib/stripe";

const planMutationSchema = z.object({
  slug: z.string().min(3).max(40).regex(/^[a-z0-9_]+$/).optional(),
  name: z.string().min(2).max(60).optional(),
  tier: z.enum(["pro", "pro_plus", "enterprise"]).optional(),
  billing_cycle: z.enum(["monthly", "annual"]).optional(),
  price_cents: z.number().int().min(0).optional(),
  max_instances: z.number().int().min(1).optional(),
  max_users: z.number().int().min(1).optional(),
  max_pipelines: z.number().int().min(1).optional(),
  max_teams: z.number().int().min(0).optional(),
  included_ai_messages: z.number().int().min(0).optional(),
  included_campaign_msgs: z.number().int().min(0).optional(),
  features: z.record(z.boolean()).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function billingRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /plans — catálogo público (não exige auth)
  // -------------------------------------------------------------------
  app.get("/plans", async () => {
    const r = await db.query(
      `SELECT id, slug, name, tier, billing_cycle, price_cents,
              max_instances, max_users, max_pipelines, max_teams,
              included_ai_messages, included_campaign_msgs, features, sort_order
         FROM subscription_plans
        WHERE is_active = TRUE
        ORDER BY sort_order ASC`,
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /billing/subscription — assinatura atual do tenant (com summary)
  // -------------------------------------------------------------------
  app.get("/subscription", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT * FROM tenant_subscription_summary WHERE tenant_id = $1`,
      [req.tenantId],
    );
    if (r.rowCount === 0) {
      return { has_subscription: false };
    }
    return { has_subscription: true, ...r.rows[0] };
  });

  // -------------------------------------------------------------------
  // POST /billing/checkout — cria Stripe Checkout pra subscription
  // Body: { plan_slug }
  // -------------------------------------------------------------------
  app.post("/checkout", { preHandler: requireTenant }, async (req, reply) => {
    if (!isStripeEnabled()) {
      return reply.code(503).send({ error: "pagamento online indisponível" });
    }

    const { plan_slug } = z.object({
      plan_slug: z.string(),
    }).parse(req.body);

    // Busca plano
    const planRes = await db.query(
      `SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = TRUE`,
      [plan_slug],
    );
    if (planRes.rowCount === 0) return reply.code(404).send({ error: "plano não encontrado" });
    const plan = planRes.rows[0];

    // Busca tenant + usuário
    const tRes = await db.query(
      `SELECT t.*, u.email AS owner_email, u.name AS owner_name
         FROM tenants t
         JOIN admin_users u ON u.tenant_id = t.id AND u.role = 'owner'
        WHERE t.id = $1 LIMIT 1`,
      [req.tenantId],
    );
    if (tRes.rowCount === 0) return reply.code(404).send({ error: "tenant não encontrado" });
    const tenant = tRes.rows[0];

    const stripe = getStripe();

    try {
      // 1) Cria ou recupera o stripe_customer_id
      let customerId: string;
      const subRes = await db.query(
        `SELECT stripe_customer_id FROM tenant_subscriptions WHERE tenant_id = $1`,
        [req.tenantId],
      );
      if (subRes.rowCount && subRes.rows[0].stripe_customer_id) {
        customerId = subRes.rows[0].stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: tenant.owner_email,
          name: tenant.name,
          metadata: { tenant_id: String(tenant.id), tenant_slug: tenant.slug },
        });
        customerId = customer.id;
      }

      // 2) Cria Price dinamicamente se ainda não tem stripe_price_id no plano
      let priceId = plan.stripe_price_id;
      if (!priceId) {
        const price = await stripe.prices.create({
          currency: "brl",
          unit_amount: plan.price_cents,
          recurring: { interval: plan.billing_cycle === "annual" ? "year" : "month" },
          product_data: {
            name: `FJN Atende — ${plan.name}`,
          } as any,
        });
        priceId = price.id;
        await db.query(
          `UPDATE subscription_plans SET stripe_price_id = $1 WHERE id = $2`,
          [priceId, plan.id],
        );
      }

      // 3) Cria Checkout Session no modo subscription
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${config.STRIPE_SUCCESS_URL}&type=subscription&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: config.STRIPE_CANCEL_URL,
        client_reference_id: String(tenant.id),
        metadata: {
          tenant_id: String(tenant.id),
          plan_id: String(plan.id),
          plan_slug: plan.slug,
        },
        subscription_data: {
          metadata: {
            tenant_id: String(tenant.id),
            plan_id: String(plan.id),
          },
        },
      });

      // 4) Cria/atualiza registro local (status='incomplete' até webhook confirmar)
      await db.query(
        `INSERT INTO tenant_subscriptions
           (tenant_id, plan_id, stripe_customer_id, status)
         VALUES ($1, $2, $3, 'incomplete')
         ON CONFLICT (tenant_id) DO UPDATE
           SET plan_id = EXCLUDED.plan_id,
               stripe_customer_id = EXCLUDED.stripe_customer_id,
               updated_at = NOW()`,
        [tenant.id, plan.id, customerId],
      );

      return { checkout_url: session.url, session_id: session.id };
    } catch (err: any) {
      req.log.error({ err }, "Erro criando checkout subscription");
      return reply.code(500).send({ error: "Falha: " + err.message });
    }
  });

  // -------------------------------------------------------------------
  // POST /billing/portal — Customer Portal (cliente gerencia tudo)
  // -------------------------------------------------------------------
  app.post("/portal", { preHandler: requireTenant }, async (req, reply) => {
    if (!isStripeEnabled()) {
      return reply.code(503).send({ error: "pagamento online indisponível" });
    }

    const r = await db.query(
      `SELECT stripe_customer_id FROM tenant_subscriptions WHERE tenant_id = $1`,
      [req.tenantId],
    );
    if (r.rowCount === 0 || !r.rows[0].stripe_customer_id) {
      return reply.code(404).send({ error: "sem assinatura ativa" });
    }

    const stripe = getStripe();
    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: r.rows[0].stripe_customer_id,
        return_url: `${config.WEB_URL}/configuracoes/plano`,
      });
      return { url: portalSession.url };
    } catch (err: any) {
      req.log.error({ err }, "Erro criando portal");
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------
  // POST /billing/cancel — cancela ao fim do período atual
  // -------------------------------------------------------------------
  app.post("/cancel", { preHandler: requireTenant }, async (req, reply) => {
    const r = await db.query(
      `SELECT stripe_subscription_id FROM tenant_subscriptions WHERE tenant_id = $1`,
      [req.tenantId],
    );
    if (r.rowCount === 0 || !r.rows[0].stripe_subscription_id) {
      return reply.code(404).send({ error: "sem assinatura ativa" });
    }

    const stripe = getStripe();
    try {
      await stripe.subscriptions.update(r.rows[0].stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      await db.query(
        `UPDATE tenant_subscriptions
            SET cancel_at_period_end = TRUE, updated_at = NOW()
          WHERE tenant_id = $1`,
        [req.tenantId],
      );

      await db.query(
        `INSERT INTO subscription_events (tenant_id, event_type)
         VALUES ($1, 'canceled')`,
        [req.tenantId],
      );

      return { ok: true, message: "Assinatura cancelada ao fim do período" };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------
  // POST /billing/reactivate — desfaz cancelamento agendado
  // -------------------------------------------------------------------
  app.post("/reactivate", { preHandler: requireTenant }, async (req, reply) => {
    const r = await db.query(
      `SELECT stripe_subscription_id FROM tenant_subscriptions WHERE tenant_id = $1`,
      [req.tenantId],
    );
    if (r.rowCount === 0 || !r.rows[0].stripe_subscription_id) {
      return reply.code(404).send({ error: "sem assinatura" });
    }

    const stripe = getStripe();
    try {
      await stripe.subscriptions.update(r.rows[0].stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      await db.query(
        `UPDATE tenant_subscriptions
            SET cancel_at_period_end = FALSE, canceled_at = NULL, updated_at = NOW()
          WHERE tenant_id = $1`,
        [req.tenantId],
      );
      await db.query(
        `INSERT INTO subscription_events (tenant_id, event_type)
         VALUES ($1, 'reactivated')`,
        [req.tenantId],
      );
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ===================================================================
  // SUPER ADMIN — dashboards & insights
  // ===================================================================

  // -------------------------------------------------------------------
  // GET /billing/admin/overview — KPIs do negócio (MRR, ARR, churn)
  // -------------------------------------------------------------------
  app.get("/admin/overview", { preHandler: requireSuperAdmin }, async () => {
    const r = await db.query(
      `WITH active_subs AS (
         SELECT s.*, p.price_cents, p.billing_cycle, p.tier
           FROM tenant_subscriptions s
           JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.status = 'active'
       ),
       mrr_calc AS (
         SELECT
           COALESCE(SUM(CASE WHEN billing_cycle = 'monthly' THEN price_cents
                             WHEN billing_cycle = 'annual'  THEN price_cents / 12
                             ELSE 0 END), 0)::bigint AS mrr_cents
           FROM active_subs
       )
       SELECT
         (SELECT COUNT(*)::int FROM active_subs)                              AS active_count,
         (SELECT COUNT(*)::int FROM tenant_subscriptions
           WHERE status = 'past_due')                                         AS past_due_count,
         (SELECT COUNT(*)::int FROM tenant_subscriptions
           WHERE status = 'canceled')                                         AS canceled_count,
         (SELECT mrr_cents FROM mrr_calc)                                     AS mrr_cents,
         (SELECT mrr_cents * 12 FROM mrr_calc)                                AS arr_cents,
         (SELECT COUNT(*)::int FROM subscription_events
           WHERE event_type IN ('canceled') AND created_at > NOW() - INTERVAL '30 days') AS churn_30d_count,
         (SELECT COUNT(*)::int FROM subscription_events
           WHERE event_type IN ('payment_succeeded') AND created_at > NOW() - INTERVAL '30 days') AS payments_30d_count,
         (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM subscription_events
           WHERE event_type IN ('payment_succeeded') AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d_cents,
         (SELECT COUNT(*)::int FROM subscription_events
           WHERE event_type IN ('payment_failed') AND created_at > NOW() - INTERVAL '30 days') AS failed_30d_count,
         (SELECT COUNT(*)::int FROM tenants WHERE status = 'pending_payment') AS pending_payment_count`,
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // GET /billing/admin/subscriptions — lista todos os assinantes
  // ?status=&tier=&search=
  // -------------------------------------------------------------------
  app.get("/admin/subscriptions", { preHandler: requireSuperAdmin }, async (req) => {
    const q = req.query as any;
    const conds: string[] = ["1=1"];
    const params: any[] = [];
    let i = 1;
    if (q.status) { conds.push(`s.status = $${i++}`); params.push(q.status); }
    if (q.tier)   { conds.push(`p.tier = $${i++}`);   params.push(q.tier); }
    if (q.search) {
      conds.push(`(t.name ILIKE $${i} OR t.slug ILIKE $${i} OR t.email ILIKE $${i})`);
      params.push(`%${q.search}%`); i++;
    }
    const where = conds.join(" AND ");

    const r = await db.query(
      `SELECT
         t.id AS tenant_id, t.slug, t.name, t.email,
         p.name AS plan_name, p.tier, p.billing_cycle, p.price_cents,
         s.status, s.current_period_end, s.cancel_at_period_end,
         s.ai_messages_used, p.included_ai_messages,
         s.created_at AS subscribed_at
       FROM tenant_subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       JOIN subscription_plans p ON p.id = s.plan_id
      WHERE ${where}
      ORDER BY s.created_at DESC
      LIMIT 200`,
      params,
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /billing/admin/tenant/:id — visão completa de billing dum tenant
  // -------------------------------------------------------------------
  app.get("/admin/tenant/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const tenantId = Number((req.params as any).id);

    const subRes = await db.query(
      `SELECT * FROM tenant_subscription_summary WHERE tenant_id = $1`,
      [tenantId],
    );

    const eventsRes = await db.query(
      `SELECT e.*, p_from.name AS from_plan_name, p_to.name AS to_plan_name
         FROM subscription_events e
         LEFT JOIN subscription_plans p_from ON p_from.id = e.from_plan_id
         LEFT JOIN subscription_plans p_to   ON p_to.id   = e.to_plan_id
        WHERE e.tenant_id = $1
        ORDER BY e.created_at DESC
        LIMIT 50`,
      [tenantId],
    );

    const creditsRes = await db.query(
      `SELECT balance_cents, total_purchased_cents, total_spent_cents
         FROM tenant_credits WHERE tenant_id = $1`,
      [tenantId],
    );

    // Resumo de gastos dos últimos 6 meses (do credit_transactions, se existir)
    const usageRes = await db.query(
      `SELECT
         TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
         COUNT(*) FILTER (WHERE kind = 'ai_overage')::int   AS ai_overage_count,
         COALESCE(SUM(amount_cents) FILTER (WHERE amount_cents > 0), 0)::bigint AS credits_added,
         COALESCE(-SUM(amount_cents) FILTER (WHERE amount_cents < 0), 0)::bigint AS credits_spent
       FROM credit_transactions
      WHERE tenant_id = $1
        AND created_at >= date_trunc('month', NOW() - INTERVAL '5 months')
      GROUP BY 1
      ORDER BY 1 DESC`,
      [tenantId],
    ).catch(() => ({ rows: [] }));

    return {
      subscription: subRes.rows[0] ?? null,
      events: eventsRes.rows,
      credits: creditsRes.rows[0] ?? null,
      monthly_usage: usageRes.rows,
    };
  });

  // -------------------------------------------------------------------
  // POST /billing/admin/tenant/:id/extend — concede N dias grátis
  // -------------------------------------------------------------------
  app.post("/admin/tenant/:id/extend", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const tenantId = Number((req.params as any).id);
    const { days, reason } = z.object({
      days: z.number().int().min(1).max(365),
      reason: z.string().max(500).optional(),
    }).parse(req.body);

    const r = await db.query(
      `UPDATE tenant_subscriptions
          SET current_period_end = COALESCE(current_period_end, NOW()) + ($1 || ' days')::interval,
              status = 'active', updated_at = NOW()
        WHERE tenant_id = $2
        RETURNING current_period_end`,
      [days, tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "tenant sem subscription" });

    await db.query(`UPDATE tenants SET status = 'active' WHERE id = $1`, [tenantId]);

    await db.query(
      `INSERT INTO subscription_events (tenant_id, event_type, metadata)
       VALUES ($1, 'admin_extended', $2)`,
      [tenantId, JSON.stringify({ days, reason: reason ?? null })],
    );

    return { ok: true, new_period_end: r.rows[0].current_period_end };
  });

  // -------------------------------------------------------------------
  // POST /billing/admin/tenant/:id/force-active — desbloqueio emergencial
  // -------------------------------------------------------------------
  app.post("/admin/tenant/:id/force-active", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const tenantId = Number((req.params as any).id);
    const { reason } = z.object({
      reason: z.string().max(500).optional(),
    }).parse(req.body);

    await db.query(`UPDATE tenants SET status = 'active' WHERE id = $1`, [tenantId]);

    await db.query(
      `UPDATE tenant_subscriptions SET status = 'active', updated_at = NOW()
        WHERE tenant_id = $1`,
      [tenantId],
    );

    await db.query(
      `INSERT INTO subscription_events (tenant_id, event_type, metadata)
       VALUES ($1, 'admin_forced_active', $2)`,
      [tenantId, JSON.stringify({ reason: reason ?? null })],
    );

    return { ok: true };
  });

  // -------------------------------------------------------------------
  // POST /billing/admin/tenant/:id/portal — gera URL do Customer Portal
  // (super-admin abre o portal Stripe do cliente pra ajudar)
  // -------------------------------------------------------------------
  app.post("/admin/tenant/:id/portal", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const tenantId = Number((req.params as any).id);
    const r = await db.query(
      `SELECT stripe_customer_id FROM tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    if (r.rowCount === 0 || !r.rows[0].stripe_customer_id) {
      return reply.code(404).send({ error: "tenant sem stripe_customer_id" });
    }
    if (!isStripeEnabled()) return reply.code(503).send({ error: "stripe não configurado" });

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: r.rows[0].stripe_customer_id,
      return_url: `${config.WEB_URL}/admin/tenants/${tenantId}`,
    });
    return { url: portal.url };
  });

  // ===================================================================
  // SUPER ADMIN — usage analytics
  // ===================================================================

  // -------------------------------------------------------------------
  // GET /billing/admin/usage — ranking de consumo + alertas de abuse
  // ?period=30d|7d|today
  // -------------------------------------------------------------------
  app.get("/admin/usage", { preHandler: requireSuperAdmin }, async (req) => {
    const period = (req.query as any).period ?? "30d";
    const intervalSql = period === "today" ? "1 day" :
                        period === "7d" ? "7 days" :
                        "30 days";

    // Ranking de consumo IA (do uso atual da subscription)
    const ranking = await db.query(
      `SELECT
         t.id AS tenant_id, t.name, t.slug, t.email, t.status AS tenant_status,
         p.name AS plan_name, p.tier,
         s.ai_messages_used, p.included_ai_messages,
         CASE WHEN p.included_ai_messages > 0
              THEN ROUND((s.ai_messages_used::numeric / p.included_ai_messages) * 100, 1)
              ELSE 0 END AS pct_used,
         s.campaign_msgs_used, p.included_campaign_msgs,
         s.current_period_end,
         (SELECT COUNT(*)::int FROM conversations c WHERE c.tenant_id = t.id
            AND c.last_message_at > NOW() - INTERVAL '${intervalSql}') AS active_conversations
       FROM tenant_subscriptions s
       JOIN tenants            t ON t.id = s.tenant_id
       JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
      ORDER BY s.ai_messages_used DESC NULLS LAST
      LIMIT 50`,
    );

    // Alertas de abuse: tenants que excederam cota ou estão > 100%
    const abuseAlerts = await db.query(
      `SELECT
         t.id AS tenant_id, t.name, t.slug, t.email,
         p.name AS plan_name,
         s.ai_messages_used, p.included_ai_messages,
         s.ai_messages_used - p.included_ai_messages AS over_count,
         ROUND((s.ai_messages_used::numeric - p.included_ai_messages) * 0.03 / 100, 2) AS overage_cost_reais
       FROM tenant_subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
        AND s.ai_messages_used > p.included_ai_messages
      ORDER BY (s.ai_messages_used - p.included_ai_messages) DESC
      LIMIT 20`,
    );

    // Totais agregados
    const totals = await db.query(
      `SELECT
         COALESCE(SUM(s.ai_messages_used), 0)::bigint        AS total_ai_messages,
         COALESCE(SUM(s.campaign_msgs_used), 0)::bigint      AS total_campaign_msgs,
         COUNT(*)::int FILTER (WHERE s.ai_messages_used > p.included_ai_messages) AS tenants_over_quota,
         COUNT(*)::int FILTER (WHERE s.status = 'active')    AS active_tenants
       FROM tenant_subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id`,
    );

    return {
      period,
      totals: totals.rows[0],
      ranking: ranking.rows,
      abuse_alerts: abuseAlerts.rows,
    };
  });

  // -------------------------------------------------------------------
  // GET /billing/admin/events — eventos recentes (audit trail)
  // -------------------------------------------------------------------
  app.get("/admin/events", { preHandler: requireSuperAdmin }, async (req) => {
    const limit = Math.min(Number((req.query as any).limit ?? 50), 200);
    const r = await db.query(
      `SELECT e.*, t.name AS tenant_name, t.slug AS tenant_slug,
              p_from.name AS from_plan_name,
              p_to.name AS to_plan_name
         FROM subscription_events e
         JOIN tenants t ON t.id = e.tenant_id
         LEFT JOIN subscription_plans p_from ON p_from.id = e.from_plan_id
         LEFT JOIN subscription_plans p_to   ON p_to.id   = e.to_plan_id
        ORDER BY e.created_at DESC
        LIMIT $1`,
      [limit],
    );
    return { items: r.rows };
  });

  // ===================================================================
  // SUPER ADMIN — gestão do catálogo de planos
  // ===================================================================

  // -------------------------------------------------------------------
  // GET /billing/admin/plans — todos (inclusive inativos)
  // -------------------------------------------------------------------
  app.get("/admin/plans", { preHandler: requireSuperAdmin }, async () => {
    const r = await db.query(
      `SELECT id, slug, name, tier, billing_cycle, price_cents, stripe_price_id,
              max_instances, max_users, max_pipelines, max_teams,
              included_ai_messages, included_campaign_msgs, features,
              is_active, sort_order, created_at,
              (SELECT COUNT(*)::int FROM tenant_subscriptions s WHERE s.plan_id = subscription_plans.id) AS subscribers_count
         FROM subscription_plans
        ORDER BY sort_order ASC, id ASC`,
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // POST /billing/admin/plans — cria plano novo
  // -------------------------------------------------------------------
  app.post("/admin/plans", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const data = planMutationSchema.parse(req.body);
    const required = ["slug", "name", "tier", "billing_cycle", "price_cents"];
    for (const f of required) {
      if ((data as any)[f] === undefined) {
        return reply.code(400).send({ error: `campo obrigatório: ${f}` });
      }
    }
    const r = await db.query(
      `INSERT INTO subscription_plans
        (slug, name, tier, billing_cycle, price_cents,
         max_instances, max_users, max_pipelines, max_teams,
         included_ai_messages, included_campaign_msgs, features, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.slug, data.name, data.tier, data.billing_cycle, data.price_cents,
        data.max_instances ?? 1, data.max_users ?? 3,
        data.max_pipelines ?? 1, data.max_teams ?? 0,
        data.included_ai_messages ?? 1000, data.included_campaign_msgs ?? 1000,
        JSON.stringify(data.features ?? {}),
        data.is_active ?? true,
        data.sort_order ?? 99,
      ],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // -------------------------------------------------------------------
  // PUT /billing/admin/plans/:id — atualiza
  // Se price_cents mudou: limpa stripe_price_id (vai ser recriado)
  // -------------------------------------------------------------------
  app.put("/admin/plans/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = planMutationSchema.parse(req.body);

    const oldRes = await db.query(`SELECT price_cents FROM subscription_plans WHERE id = $1`, [id]);
    if (oldRes.rowCount === 0) return reply.code(404).send({ error: "plano não encontrado" });
    const oldPrice = oldRes.rows[0].price_cents;

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(k === "features" ? JSON.stringify(v) : v);
    }

    // Se mudou o preço, força criação de novo Stripe Price na próxima
    if (data.price_cents !== undefined && data.price_cents !== oldPrice) {
      fields.push(`stripe_price_id = NULL`);
    }

    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    values.push(id);

    const r = await db.query(
      `UPDATE subscription_plans SET ${fields.join(", ")}
        WHERE id = $${i}
        RETURNING *`,
      values,
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // DELETE /billing/admin/plans/:id — desativa
  // -------------------------------------------------------------------
  app.delete("/admin/plans/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);

    const subs = await db.query(
      `SELECT COUNT(*)::int AS c FROM tenant_subscriptions WHERE plan_id = $1 AND status = 'active'`,
      [id],
    );
    if (subs.rows[0].c > 0) {
      return reply.code(400).send({
        error: `${subs.rows[0].c} cliente(s) ativo(s) neste plano — não pode apagar. Apenas desative (is_active=false).`,
      });
    }

    const r = await db.query(
      `UPDATE subscription_plans SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [id],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "plano não encontrado" });
    return { ok: true };
  });

  // -------------------------------------------------------------------
  // POST /billing/change-plan — mudar de plano (Stripe prorate automático)
  // Body: { plan_slug }
  // -------------------------------------------------------------------
  app.post("/change-plan", { preHandler: requireTenant }, async (req, reply) => {
    const { plan_slug } = z.object({ plan_slug: z.string() }).parse(req.body);

    const planRes = await db.query(
      `SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = TRUE`,
      [plan_slug],
    );
    if (planRes.rowCount === 0) return reply.code(404).send({ error: "plano não encontrado" });
    const plan = planRes.rows[0];

    const subRes = await db.query(
      `SELECT * FROM tenant_subscriptions WHERE tenant_id = $1`,
      [req.tenantId],
    );
    if (subRes.rowCount === 0 || !subRes.rows[0].stripe_subscription_id) {
      return reply.code(404).send({ error: "sem assinatura ativa pra alterar" });
    }
    const oldSub = subRes.rows[0];

    if (oldSub.plan_id === plan.id) {
      return reply.code(400).send({ error: "já está nesse plano" });
    }

    const stripe = getStripe();
    try {
      // Garante que o plano tem price no Stripe
      let priceId = plan.stripe_price_id;
      if (!priceId) {
        const price = await stripe.prices.create({
          currency: "brl",
          unit_amount: plan.price_cents,
          recurring: { interval: plan.billing_cycle === "annual" ? "year" : "month" },
          product_data: { name: `FJN Atende — ${plan.name}` } as any,
        });
        priceId = price.id;
        await db.query(`UPDATE subscription_plans SET stripe_price_id = $1 WHERE id = $2`,
                       [priceId, plan.id]);
      }

      const subscription = await stripe.subscriptions.retrieve(oldSub.stripe_subscription_id);
      await stripe.subscriptions.update(oldSub.stripe_subscription_id, {
        items: [{ id: subscription.items.data[0].id, price: priceId }],
        proration_behavior: "create_prorations",
      });

      await db.query(
        `UPDATE tenant_subscriptions
            SET plan_id = $1, stripe_price_id = $2, updated_at = NOW()
          WHERE tenant_id = $3`,
        [plan.id, priceId, req.tenantId],
      );

      await db.query(
        `INSERT INTO subscription_events (tenant_id, event_type, from_plan_id, to_plan_id)
         VALUES ($1, 'plan_changed', $2, $3)`,
        [req.tenantId, oldSub.plan_id, plan.id],
      );

      return { ok: true, new_plan: plan.name };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
