import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { config } from "./config";
import { authRoutes } from "./modules/auth/auth.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { conversationsRoutes } from "./modules/conversations/conversations.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";
import { handoffsRoutes } from "./modules/handoffs/handoffs.routes";
import { configRoutes } from "./modules/config/config.routes";
import { tenantsRoutes } from "./modules/tenants/tenants.routes";
import { instancesRoutes } from "./modules/instances/instances.routes";
import { contactListsRoutes } from "./modules/campaigns/contact-lists.routes";
import { templatesRoutes } from "./modules/campaigns/templates.routes";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { creditsRoutes } from "./modules/credits/credits.routes";
import { paymentRoutes } from "./modules/credits/payment.routes";
import { pipelinesRoutes } from "./modules/funnel/pipelines.routes";
import { teamsRoutes } from "./modules/funnel/teams.routes";
import { cardsRoutes } from "./modules/funnel/cards.routes";
import { funnelMetricsRoutes } from "./modules/funnel/metrics.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { brandingRoutes } from "./modules/branding/branding.routes";
import { tenantNotesRoutes } from "./modules/admin/tenant-notes.routes";
import { documentsRoutes } from "./modules/documents/documents.routes";
import { metaWebhookRoutes } from "./modules/meta/meta-webhook.routes";
import { shutdownDb } from "./db/client";
import { registerSocket, startRealtime, stopRealtime } from "./lib/realtime";
import { startCampaignWorker, stopCampaignWorker } from "./jobs/campaigns-sender";
import { startLowBalanceWorker, stopLowBalanceWorker } from "./jobs/low-balance-notifier";
import { startOnboardingWorker, stopOnboardingWorker } from "./jobs/onboarding-emails";
import { requireActiveTenant } from "./lib/auth";

// =====================================================================
// Billing Gate — rotas que EXIGEM tenant.status='active'
// Super-admin sempre passa. Tudo abaixo dispara middleware requireActiveTenant.
// =====================================================================
const BILLING_GATED_PREFIXES = [
  "/conversations",
  "/leads",
  "/handoffs",
  "/instances",
  "/contact-lists",
  "/templates",
  "/campaigns",
  "/pipelines",
  "/teams",
  "/cards",
  "/funnel-metrics",
];

function isBillingGated(url: string): boolean {
  // Ignora query string
  const path = url.split("?")[0];
  return BILLING_GATED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { colorize: true } },
  },
});

async function bootstrap() {
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [config.WEB_URL, "http://localhost:3000"];
      if (!origin || allowed.includes(origin) || origin.endsWith(".vercel.app")) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES } });
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max upload (CSV)
  });

  // Captura raw body só pra rotas com config.rawBody = true (Stripe webhook)
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (req, body: any, done) {
      try {
        const text = body.toString("utf-8");
        (req as any).rawBody = text;
        done(null, text ? JSON.parse(text) : {});
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  // Billing Gate: aplica requireActiveTenant em rotas operacionais
  app.addHook("preHandler", async (req, reply) => {
    if (!isBillingGated(req.url)) return;
    await requireActiveTenant(req as any, reply as any);
  });

  app.get("/ws", { websocket: true }, (conn, req) => {
    const token = (req.query as any)?.token as string | undefined;
    if (!token) {
      conn.send(JSON.stringify({ error: "no token" }));
      conn.close();
      return;
    }
    try {
      app.jwt.verify(token);
    } catch {
      conn.send(JSON.stringify({ error: "invalid token" }));
      conn.close();
      return;
    }
    registerSocket(conn as any);
    conn.send(JSON.stringify({ channel: "hello", payload: { ok: true } }));
  });

  app.register(authRoutes,          { prefix: "/auth" });
  app.register(dashboardRoutes,     { prefix: "/dashboard" });
  app.register(conversationsRoutes, { prefix: "/conversations" });
  app.register(leadsRoutes,         { prefix: "/leads" });
  app.register(handoffsRoutes,      { prefix: "/handoffs" });
  app.register(configRoutes,        { prefix: "/config" });
  app.register(tenantsRoutes,       { prefix: "/tenants" });
  app.register(instancesRoutes,     { prefix: "/instances" });

  // Módulo Campanhas (FJN Disparo)
  app.register(contactListsRoutes,  { prefix: "/contact-lists" });
  app.register(templatesRoutes,     { prefix: "/templates" });
  app.register(campaignsRoutes,     { prefix: "/campaigns" });
  app.register(creditsRoutes,       { prefix: "/credits" });
  app.register(paymentRoutes,       { prefix: "/credits" });   // /credits/checkout, /credits/stripe-webhook

  // Módulo Funil de Atendimento (CRM)
  app.register(pipelinesRoutes,     { prefix: "/pipelines" });
  app.register(teamsRoutes,         { prefix: "/teams" });
  app.register(cardsRoutes,         { prefix: "/cards" });
  app.register(funnelMetricsRoutes, { prefix: "/funnel-metrics" });

  // Módulo Billing (Stripe Subscriptions)
  // Routes: GET /plans (público), GET /billing/subscription, POST /billing/checkout,
  //         POST /billing/portal, POST /billing/cancel, POST /billing/reactivate,
  //         POST /billing/change-plan
  app.register(billingRoutes, { prefix: "/billing" });

  // Módulo Branding (white-label)
  app.register(brandingRoutes, { prefix: "/branding" });

  // CRM admin — notas internas por tenant
  app.register(tenantNotesRoutes, { prefix: "/admin/tenant-notes" });

  // Documentos (orçamentos e contratos)
  app.register(documentsRoutes, { prefix: "/documents" });

  // Meta Cloud API — webhook do WhatsApp Business Platform
  app.register(metaWebhookRoutes, { prefix: "/meta" });
  // Atalho público pra GET /plans (sem prefix /billing pra facilitar landing)
  app.get("/plans", async () => {
    const { db } = await import("./db/client");
    const r = await db.query(
      `SELECT id, slug, name, tier, billing_cycle, price_cents,
              max_instances, max_users, max_pipelines, max_teams,
              included_ai_messages, included_campaign_msgs, features, sort_order
         FROM subscription_plans WHERE is_active = TRUE ORDER BY sort_order ASC`,
    );
    return { items: r.rows };
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  await startRealtime();
  startCampaignWorker();
  startLowBalanceWorker();
  startOnboardingWorker();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`FJN Painel API ouvindo na porta ${config.PORT}`);
}

const shutdown = async (sig: string) => {
  app.log.info(`Sinal ${sig} — encerrando...`);
  stopCampaignWorker();
  stopLowBalanceWorker();
  stopOnboardingWorker();
  await stopRealtime();
  await app.close();
  await shutdownDb();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
