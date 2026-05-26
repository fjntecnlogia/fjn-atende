import type { FastifyInstance } from "fastify";
import { config } from "../config";
import { db } from "../db/client";
import { bufferMessage } from "../core/conversation";
import { scheduleProcessing } from "../core/processor";
import { transcribeAudio, describeImage } from "../services/media";
import { getWhatsAppProvider } from "../services/whatsapp";

/**
 * Webhook unificado multi-tenant.
 *
 * Rota: POST /webhook?token=<WEBHOOK_TOKEN>
 *
 * Resolve o tenant_id pelo `session_name` (Evolution/WPP-Connect)
 * ou pelo `instanceId` (UltraMsg legado).
 */

async function resolveTenantId(payload: any): Promise<number | null> {
  // Tenta extrair o nome da sessão de diferentes formatos de payload
  const sessionName: string | undefined =
    payload?.session                            // WPP-Connect
    ?? payload?.instance                        // Evolution
    ?? payload?.instanceId;                     // UltraMsg

  if (sessionName) {
    const r = await db.query<{ tenant_id: number }>(
      `SELECT tenant_id FROM whatsapp_instances
        WHERE session_name = $1 LIMIT 1`,
      [sessionName],
    );
    if (r.rowCount && r.rowCount > 0) return r.rows[0].tenant_id;
  }

  // Fallback: tenant FJN (#1) — útil em dev / single-tenant
  if (config.NODE_ENV !== "production") return 1;
  return null;
}

export async function registerWhatsAppWebhook(app: FastifyInstance) {
  const provider = getWhatsAppProvider();

  const handler = async (req: any, reply: any) => {
    const token = req.query?.token;
    if (token !== config.WEBHOOK_TOKEN) {
      return reply.code(401).send({ error: "invalid token" });
    }

    const msg = provider.parseWebhook(req.body);
    if (!msg || msg.fromMe || !msg.phone) {
      return reply.code(200).send({ ok: true, ignored: true });
    }

    // Responde rápido pro provedor não retry
    reply.code(200).send({ ok: true });

    setImmediate(async () => {
      try {
        // Descobre tenant
        const tenantId = await resolveTenantId(req.body);
        if (!tenantId) {
          req.log.warn({ phone: msg.phone }, "tenant não resolvido — mensagem descartada");
          return;
        }

        // Verifica se tenant está ativo
        const t = await db.query<{ status: string; plan: string }>(
          `SELECT status, plan FROM tenants WHERE id = $1`,
          [tenantId],
        );
        if (t.rowCount === 0 || t.rows[0].status !== "active") {
          req.log.warn({ tenantId }, "tenant inativo — mensagem descartada");
          return;
        }

        let content = "";
        if (msg.type === "chat") {
          content = msg.body;
        } else if (msg.type === "audio" && msg.mediaUrl) {
          const transcript = await transcribeAudio(msg.mediaUrl);
          content = transcript
            ? `[Áudio do cliente — transcrição automática]\n${transcript}`
            : "[O cliente enviou um áudio que não consegui transcrever. Peça pra ele resumir por texto.]";
        } else if (msg.type === "image" && msg.mediaUrl) {
          const description = await describeImage(msg.mediaUrl, msg.caption);
          if (description) {
            content = `[Imagem do cliente] ${description}`;
            if (msg.caption) content += `\n[Legenda]: "${msg.caption}"`;
          } else {
            content = "[O cliente enviou uma imagem mas não consegui analisar. Peça pra ele descrever.]";
          }
        } else {
          content = `[O cliente enviou um(a) ${msg.type} via WhatsApp]`;
        }

        if (!content) return;

        await bufferMessage(tenantId, msg.phone, content);
        scheduleProcessing(tenantId, msg.phone, msg.name);
      } catch (err) {
        req.log.error({ err, phone: msg.phone, type: msg.type }, "falha processando webhook");
      }
    });
  };

  app.post("/webhook", handler);
  app.post("/webhook/ultramsg", handler);
  app.post("/webhook/evolution", handler);
  app.post("/webhook/wppconnect", handler);
}

export { registerWhatsAppWebhook as registerUltramsgWebhook };
