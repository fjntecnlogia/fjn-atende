import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { config } from "./config";
import { authRoutes } from "./modules/auth/auth.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { conversationsRoutes } from "./modules/conversations/conversations.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";
import { handoffsRoutes } from "./modules/handoffs/handoffs.routes";
import { configRoutes } from "./modules/config/config.routes";
import { tenantsRoutes } from "./modules/tenants/tenants.routes";
import { instancesRoutes } from "./modules/instances/instances.routes";
import { shutdownDb } from "./db/client";
import { registerSocket, startRealtime, stopRealtime } from "./lib/realtime";

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

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

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
  app.register(tenantsRoutes,       { prefix: "/tenants" });   // super-admin only
  app.register(instancesRoutes,     { prefix: "/instances" }); // WhatsApp por tenant

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  await startRealtime();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`FJN Painel API ouvindo na porta ${config.PORT}`);
}

const shutdown = async (sig: string) => {
  app.log.info(`Sinal ${sig} — encerrando...`);
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
