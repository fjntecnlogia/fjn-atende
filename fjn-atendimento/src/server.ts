import Fastify from "fastify";
import { config } from "./config";
import { registerUltramsgWebhook } from "./webhooks/ultramsg";
import { shutdownDb } from "./db/client";

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { colorize: true } },
  },
});

app.get("/healthz", async () => ({ ok: true, ts: Date.now() }));

registerUltramsgWebhook(app);

async function bootstrap() {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`FJN Atendimento ouvindo na porta ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  app.log.info(`Sinal ${signal} recebido — encerrando...`);
  try {
    await app.close();
    await shutdownDb();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap();
