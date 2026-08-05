/**
 * Webhook do WhatsApp Business Platform (Meta Cloud API).
 *
 * Endpoints:
 *  GET  /meta/webhook  → verificação inicial (hub.challenge)
 *  POST /meta/webhook  → recebe eventos (mensagens, status)
 *
 * Configure na Meta Developers:
 *  Callback URL:  https://api-painel.fjntecnologia.com.br/meta/webhook
 *  Verify Token:  o mesmo que META_WA_VERIFY_TOKEN do .env
 */
import type { FastifyInstance } from "fastify";
import axios from "axios";
import { config } from "../../config";
import { verifyMetaWebhookSignature } from "../../lib/meta-cloud";

export async function metaWebhookRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET — verificação inicial da Meta (obrigatório)
  // Meta manda GET com ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
  // Devemos responder Y (só o challenge, texto puro) se o token bate.
  // -------------------------------------------------------------------
  app.get("/webhook", async (req, reply) => {
    const q = req.query as any;
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    if (mode === "subscribe" && token === config.META_WA_VERIFY_TOKEN) {
      req.log.info({ token: "match" }, "Meta webhook verificado");
      reply.header("Content-Type", "text/plain");
      return reply.send(challenge);
    }
    req.log.warn({ mode, token }, "Meta webhook verify falhou");
    return reply.code(403).send({ error: "verify token mismatch" });
  });

  // -------------------------------------------------------------------
  // POST — eventos (mensagem recebida, status de entrega, etc)
  // -------------------------------------------------------------------
  app.post("/webhook", {
    config: { rawBody: true } as any,
  }, async (req, reply) => {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    const signature = req.headers["x-hub-signature-256"] as string;

    // Valida assinatura (Meta assina com HMAC-SHA256 usando App Secret)
    if (config.META_WA_APP_SECRET && !verifyMetaWebhookSignature(rawBody, signature)) {
      req.log.warn("Assinatura Meta inválida");
      return reply.code(403).send({ error: "invalid signature" });
    }

    const body: any = req.body;
    req.log.info({ object: body?.object }, "Meta webhook evento");

    // Processa cada mudança
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};

        // Mensagens recebidas
        for (const msg of value?.messages ?? []) {
          const from = msg.from;  // wa_id (número sem +)
          const type = msg.type;
          const text = msg?.text?.body ?? "";
          req.log.info({ from, type, preview: text.slice(0, 50) }, "Meta: msg recebida");

          // Encaminha pro atendimento worker (mesmo webhook interno do WPP-Connect/Evolution)
          try {
            await axios.post(
              config.ATENDIMENTO_WEBHOOK_URL,
              {
                provider: "meta_cloud",
                phone_number_id: value?.metadata?.phone_number_id,
                display_phone_number: value?.metadata?.display_phone_number,
                from,
                message_id: msg.id,
                type,
                text,
                raw: msg,
                contact_name: value?.contacts?.[0]?.profile?.name,
              },
              {
                headers: {
                  "X-Webhook-Token": config.WEBHOOK_TOKEN,
                  "Content-Type": "application/json",
                },
                timeout: 10_000,
              },
            );
          } catch (err: any) {
            req.log.error({ err: err.message }, "Falha encaminhando pra atendimento");
          }
        }

        // Status de entrega/leitura (sent → delivered → read → failed)
        for (const status of value?.statuses ?? []) {
          req.log.info({
            id: status.id,
            status: status.status,
            recipient: status.recipient_id,
          }, "Meta: status update");
        }
      }
    }

    return { received: true };
  });
}
