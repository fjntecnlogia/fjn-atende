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
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object as any;
          await handleSessionCompleted(session, req.log);
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
