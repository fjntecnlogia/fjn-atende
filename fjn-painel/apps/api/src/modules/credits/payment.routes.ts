import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { config } from "../../config";
import { requireTenant } from "../../lib/auth";
import { getStripe, isStripeEnabled } from "../../lib/stripe";
import { sendReceiptEmail } from "../../lib/email";

export async function paymentRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // GET /credits/payment-config  — informa se Stripe está habilitado
  // -----------------------------------------------------------------
  app.get("/payment-config", { preHandler: requireTenant }, async () => {
    return {
      stripe_enabled: isStripeEnabled(),
      currency: "brl",
      methods: ["card", "pix", "boleto"],
      packages: [
        { amount_cents: 5000,   label: "R$ 50",   bonus_cents: 0,    description: "~1.500 msgs WPP" },
        { amount_cents: 10000,  label: "R$ 100",  bonus_cents: 500,  description: "~3.000 msgs + R$ 5 bônus" },
        { amount_cents: 20000,  label: "R$ 200",  bonus_cents: 2000, description: "~6.000 msgs + R$ 20 bônus" },
        { amount_cents: 50000,  label: "R$ 500",  bonus_cents: 7500, description: "~15.000 msgs + R$ 75 bônus" },
        { amount_cents: 100000, label: "R$ 1000", bonus_cents: 20000,description: "~30.000 msgs + R$ 200 bônus" },
      ],
    };
  });

  // -----------------------------------------------------------------
  // POST /credits/checkout — cria Stripe Checkout Session
  // Body: { amount_cents }
  // Retorna: { checkout_url, session_id }
  // -----------------------------------------------------------------
  app.post("/checkout", { preHandler: requireTenant }, async (req, reply) => {
    if (!isStripeEnabled()) {
      return reply.code(503).send({ error: "Pagamento online indisponível. Contate o suporte FJN." });
    }

    const body = z.object({
      amount_cents: z.number().int().min(1000).max(10_000_00),   // mín R$ 10, máx R$ 10.000
      methods: z.array(z.enum(["card", "pix", "boleto"])).default(["card", "pix"]),
    }).parse(req.body);

    // Calcula bônus baseado no valor (mesmas faixas do /payment-config)
    let bonus = 0;
    if (body.amount_cents >= 100000) bonus = 20000;
    else if (body.amount_cents >= 50000) bonus = 7500;
    else if (body.amount_cents >= 20000) bonus = 2000;
    else if (body.amount_cents >= 10000) bonus = 500;

    const totalCredit = body.amount_cents + bonus;
    const stripe = getStripe();

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "brl",
        payment_method_types: body.methods as any,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `Crédito FJN Atende — R$ ${(body.amount_cents/100).toFixed(2)}`,
                description: bonus > 0
                  ? `Inclui bônus de R$ ${(bonus/100).toFixed(2)}. Total creditado: R$ ${(totalCredit/100).toFixed(2)}`
                  : `Crédito de R$ ${(body.amount_cents/100).toFixed(2)} pra disparos`,
              },
              unit_amount: body.amount_cents,
            },
            quantity: 1,
          },
        ],
        success_url: `${config.STRIPE_SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: config.STRIPE_CANCEL_URL,
        client_reference_id: String(req.tenantId),
        metadata: {
          tenant_id: String(req.tenantId),
          amount_cents: String(body.amount_cents),
          bonus_cents: String(bonus),
          total_credit_cents: String(totalCredit),
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
      });

      // Registra no banco
      await db.query(
        `INSERT INTO stripe_checkout_sessions
          (tenant_id, session_id, amount_cents, currency, payment_method_types,
           status, success_url, cancel_url, checkout_url, created_by, expires_at, metadata)
         VALUES ($1,$2,$3,'brl',$4,'pending',$5,$6,$7,$8,$9,$10)`,
        [
          req.tenantId!, session.id, totalCredit, body.methods,
          session.success_url ?? null, session.cancel_url ?? null, session.url ?? null,
          req.user.sub, new Date((session.expires_at ?? 0) * 1000),
          JSON.stringify({ amount_paid: body.amount_cents, bonus, total_credit: totalCredit }),
        ],
      );

      return {
        checkout_url: session.url,
        session_id: session.id,
        amount_paid_cents: body.amount_cents,
        bonus_cents: bonus,
        total_credit_cents: totalCredit,
      };
    } catch (err: any) {
      req.log.error({ err }, "Erro criando Stripe Checkout");
      return reply.code(500).send({ error: "Falha ao criar pagamento: " + err.message });
    }
  });

  // -----------------------------------------------------------------
  // GET /credits/checkout/:sessionId — status de uma sessão
  // -----------------------------------------------------------------
  app.get("/checkout/:sessionId", { preHandler: requireTenant }, async (req, reply) => {
    const sessionId = (req.params as any).sessionId;
    const r = await db.query(
      `SELECT * FROM stripe_checkout_sessions
        WHERE session_id = $1 AND tenant_id = $2`,
      [sessionId, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "session não encontrada" });
    return r.rows[0];
  });

  // -----------------------------------------------------------------
  // POST /credits/stripe-webhook — recebe eventos do Stripe
  //   ATENÇÃO: este endpoint NÃO usa requireAuth (Stripe que chama)
  //   Validação por signature do webhook.
  //   RAW BODY é necessário pra validar — Fastify precisa de config especial.
  // -----------------------------------------------------------------
  app.post(
    "/stripe-webhook",
    {
      config: { rawBody: true } as any,
    },
    async (req, reply) => {
      if (!isStripeEnabled() || !config.STRIPE_WEBHOOK_SECRET) {
        return reply.code(503).send({ error: "stripe não configurado" });
      }
      const signature = req.headers["stripe-signature"] as string;
      if (!signature) return reply.code(400).send({ error: "sem signature" });

      const stripe = getStripe();
      let event;
      try {
        // raw body — vem como string ou Buffer
        const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
        event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        req.log.warn({ err: err.message }, "Stripe webhook signature inválida");
        return reply.code(400).send({ error: `signature inválida: ${err.message}` });
      }

      req.log.info({ event_type: event.type, id: event.id }, "Stripe webhook recebido");

      switch (event.type) {
        // ============ Checkout (compra de crédito pré-pago) ============
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object as any;
          // Distingue checkout de subscription (sub) vs payment (compra avulsa)
          if (session.mode === "subscription") {
            await handleSubscriptionCheckout(session, req.log);
          } else {
            await handleSessionCompleted(session, req.log);
          }
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object as any;
          await db.query(
            `UPDATE stripe_checkout_sessions SET status = 'expired' WHERE session_id = $1`,
            [session.id],
          );
          break;
        }

        case "checkout.session.async_payment_failed": {
          const session = event.data.object as any;
          await db.query(
            `UPDATE stripe_checkout_sessions SET status = 'failed' WHERE session_id = $1`,
            [session.id],
          );
          break;
        }

        // ============ Subscriptions (planos recorrentes) ============
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          await handleSubscriptionUpdated(sub, req.log);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          await handleSubscriptionDeleted(sub, req.log);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as any;
          await handleInvoicePaid(invoice, req.log);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          await handleInvoiceFailed(invoice, req.log);
          break;
        }
      }

      return { received: true };
    },
  );
}

async function handleSessionCompleted(session: any, log: any): Promise<void> {
  // Idempotência: já processado?
  const existing = await db.query(
    `SELECT id, status FROM stripe_checkout_sessions WHERE session_id = $1`,
    [session.id],
  );
  if (existing.rowCount === 0) {
    log.warn({ session_id: session.id }, "Stripe session não encontrada no banco");
    return;
  }
  if (existing.rows[0].status === "complete") {
    log.info({ session_id: session.id }, "Sessão já processada — skip");
    return;
  }

  const tenantId = Number(session.metadata?.tenant_id ?? session.client_reference_id);
  const amountPaid = Number(session.metadata?.amount_cents ?? session.amount_total);
  const bonus = Number(session.metadata?.bonus_cents ?? 0);

  if (!tenantId) {
    log.error({ session_id: session.id }, "tenant_id ausente — não creditando");
    return;
  }

  // Crédito principal
  await db.query(
    `SELECT add_credits($1, $2, 'purchase', $3, 'stripe', $4, NULL)`,
    [
      tenantId, amountPaid,
      `Compra Stripe (sessão ${session.id})`,
      session.payment_intent ?? session.id,
    ],
  );

  // Bônus separado, se houver
  if (bonus > 0) {
    await db.query(
      `SELECT add_credits($1, $2, 'bonus', $3, 'stripe', $4, NULL)`,
      [
        tenantId, bonus,
        `Bônus pela compra ${session.id}`,
        session.payment_intent ?? session.id,
      ],
    );
  }

  await db.query(
    `UPDATE stripe_checkout_sessions
        SET status = 'complete', completed_at = NOW(), payment_intent_id = $2
      WHERE session_id = $1`,
    [session.id, session.payment_intent ?? null],
  );

  log.info(
    { tenant_id: tenantId, amount: amountPaid, bonus, session_id: session.id },
    "Crédito Stripe aplicado",
  );

  // E-mail de recibo (mantém implementação anterior abaixo)
  // E-mail de recibo — busca dados do owner + saldo atualizado
  try {
    const ownerQ = await db.query(
      `SELECT au.email, au.name
         FROM admin_users au
        WHERE au.tenant_id = $1 AND au.role = 'owner'
        ORDER BY au.id ASC LIMIT 1`,
      [tenantId],
    );
    const balanceQ = await db.query(
      `SELECT balance_cents FROM tenant_credits WHERE tenant_id = $1`,
      [tenantId],
    );
    const owner = ownerQ.rows[0];
    const balance = Number(balanceQ.rows[0]?.balance_cents ?? 0);

    if (owner) {
      await sendReceiptEmail({
        to: owner.email,
        userName: owner.name,
        amountCents: amountPaid,
        bonusCents: bonus,
        newBalanceCents: balance,
        paymentId: session.payment_intent ?? session.id,
      });
    }
  } catch (err: any) {
    log.warn({ err: err.message, session_id: session.id }, "Falha enviando recibo por e-mail");
  }
}

// =====================================================================
// SUBSCRIPTIONS — handlers
// =====================================================================

/**
 * Quando checkout em modo subscription completa.
 * Stripe já criou a subscription. Vamos salvar IDs e ativar tenant.
 */
async function handleSubscriptionCheckout(session: any, log: any): Promise<void> {
  const tenantId = Number(session.metadata?.tenant_id ?? session.client_reference_id);
  if (!tenantId) {
    log.error({ session_id: session.id }, "subscription sem tenant_id");
    return;
  }

  if (!session.subscription) {
    log.warn({ session_id: session.id }, "checkout subscription sem subscription_id ainda");
    return;
  }

  // Sub real virá no customer.subscription.created — aqui só guardamos o customer
  await db.query(
    `UPDATE tenant_subscriptions
        SET stripe_customer_id = $1, updated_at = NOW()
      WHERE tenant_id = $2`,
    [session.customer, tenantId],
  );

  log.info({ tenant_id: tenantId, session_id: session.id }, "Subscription checkout completou");
}

/**
 * customer.subscription.created / updated
 * Sincroniza status, período, plan.
 */
async function handleSubscriptionUpdated(sub: any, log: any): Promise<void> {
  const tenantId = Number(sub.metadata?.tenant_id);
  if (!tenantId) {
    log.warn({ sub_id: sub.id }, "subscription sem tenant_id no metadata");
    return;
  }

  // Acha plan_id pelo stripe_price_id
  const priceId = sub.items?.data?.[0]?.price?.id;
  const planRes = await db.query(
    `SELECT id FROM subscription_plans WHERE stripe_price_id = $1`,
    [priceId],
  );
  const planId = planRes.rows[0]?.id ?? Number(sub.metadata?.plan_id);

  await db.query(
    `INSERT INTO tenant_subscriptions
       (tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        status, current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), to_timestamp($8), $9)
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      tenantId, planId, sub.customer, sub.id, priceId,
      sub.status, sub.current_period_start, sub.current_period_end,
      sub.cancel_at_period_end ?? false,
    ],
  );

  // Ativa tenant se sub está active
  if (sub.status === "active") {
    await db.query(
      `UPDATE tenants SET status = 'active' WHERE id = $1`,
      [tenantId],
    );
  } else if (sub.status === "past_due" || sub.status === "unpaid") {
    // Bloqueio imediato em falha de pagamento
    await db.query(
      `UPDATE tenants SET status = 'past_due' WHERE id = $1`,
      [tenantId],
    );
  }

  await db.query(
    `INSERT INTO subscription_events (tenant_id, event_type, stripe_event_id, to_plan_id)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, `sub_${sub.status}`, sub.id, planId],
  );

  log.info({ tenant_id: tenantId, status: sub.status, sub_id: sub.id },
           "Subscription sincronizada");
}

/**
 * customer.subscription.deleted
 */
async function handleSubscriptionDeleted(sub: any, log: any): Promise<void> {
  const tenantId = Number(sub.metadata?.tenant_id);
  if (!tenantId) return;

  await db.query(
    `UPDATE tenant_subscriptions
        SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
      WHERE stripe_subscription_id = $1`,
    [sub.id],
  );

  // Tenant volta pra pending_payment (não bloqueia hard ainda — current_period_end ainda válido)
  await db.query(
    `UPDATE tenants SET status = 'pending_payment' WHERE id = $1`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO subscription_events (tenant_id, event_type, stripe_event_id)
     VALUES ($1, 'canceled', $2)`,
    [tenantId, sub.id],
  );

  log.info({ tenant_id: tenantId, sub_id: sub.id }, "Subscription cancelada");
}

/**
 * invoice.payment_succeeded — pagamento bateu, reseta cota de uso
 */
async function handleInvoicePaid(invoice: any, log: any): Promise<void> {
  if (!invoice.subscription) return;

  // Reseta cota do ciclo
  await db.query(
    `UPDATE tenant_subscriptions
        SET ai_messages_used = 0, campaign_msgs_used = 0,
            status = 'active', updated_at = NOW()
      WHERE stripe_subscription_id = $1`,
    [invoice.subscription],
  );

  const subRes = await db.query(
    `SELECT tenant_id FROM tenant_subscriptions WHERE stripe_subscription_id = $1`,
    [invoice.subscription],
  );
  if (subRes.rowCount && subRes.rows[0]) {
    const tenantId = subRes.rows[0].tenant_id;
    await db.query(
      `UPDATE tenants SET status = 'active' WHERE id = $1`,
      [tenantId],
    );
    await db.query(
      `INSERT INTO subscription_events (tenant_id, event_type, stripe_event_id, amount_cents)
       VALUES ($1, 'payment_succeeded', $2, $3)`,
      [tenantId, invoice.id, invoice.amount_paid ?? 0],
    );
    log.info({ tenant_id: tenantId, invoice_id: invoice.id, amount: invoice.amount_paid },
             "Invoice paga + cotas resetadas");
  }
}

/**
 * invoice.payment_failed — bloqueio imediato
 */
async function handleInvoiceFailed(invoice: any, log: any): Promise<void> {
  if (!invoice.subscription) return;

  await db.query(
    `UPDATE tenant_subscriptions
        SET status = 'past_due', updated_at = NOW()
      WHERE stripe_subscription_id = $1`,
    [invoice.subscription],
  );

  const subRes = await db.query(
    `SELECT tenant_id FROM tenant_subscriptions WHERE stripe_subscription_id = $1`,
    [invoice.subscription],
  );
  if (subRes.rowCount && subRes.rows[0]) {
    const tenantId = subRes.rows[0].tenant_id;
    await db.query(
      `UPDATE tenants SET status = 'past_due' WHERE id = $1`,
      [tenantId],
    );
    await db.query(
      `INSERT INTO subscription_events (tenant_id, event_type, stripe_event_id, amount_cents)
       VALUES ($1, 'payment_failed', $2, $3)`,
      [tenantId, invoice.id, invoice.amount_due ?? 0],
    );
    log.warn({ tenant_id: tenantId, invoice_id: invoice.id }, "Invoice falhou — tenant bloqueado");
  }
}
