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
import { requireAuth, requireTenant } from "../../lib/auth";
import { getStripe, isStripeEnabled } from "../../lib/stripe";

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
