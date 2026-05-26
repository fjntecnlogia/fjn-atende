import { db } from "../db/client";
import { getWhatsAppProvider } from "../services/whatsapp";
import { pauseBot } from "./conversation";
import { config } from "../config";

export async function registerHandoff(
  tenantId: number,
  conversationId: number,
  reason: string,
  triggerMessage: string,
  contactPhone: string,
  contactName: string | null,
) {
  await db.query(
    `INSERT INTO handoffs (tenant_id, conversation_id, reason, trigger_message)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, conversationId, reason, triggerMessage],
  );

  await pauseBot(conversationId, config.HANDOFF_PAUSE_MINUTES);

  // Notifica no WhatsApp do dono do tenant (notify_phone) — fallback pro env
  const notifyPhoneRes = await db.query<{ notify_phone: string | null; name: string }>(
    `SELECT notify_phone, name FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const notifyPhone = notifyPhoneRes.rows[0]?.notify_phone || config.HANDOFF_NOTIFY_PHONE;
  const tenantName = notifyPhoneRes.rows[0]?.name ?? `Tenant ${tenantId}`;

  if (!notifyPhone) {
    console.warn(`[t${tenantId}] handoff registrado mas sem notify_phone configurado`);
    return;
  }

  const notify = [
    `🔔 *Novo handoff* — ${tenantName}`,
    `Motivo: ${reason}`,
    `Cliente: ${contactName ?? "(sem nome)"} — ${contactPhone}`,
    `Última msg: ${triggerMessage.slice(0, 200)}`,
    `Bot pausado por ${config.HANDOFF_PAUSE_MINUTES} min.`,
  ].join("\n");

  try {
    await getWhatsAppProvider().sendText(notifyPhone, notify);
  } catch (err) {
    console.error("Falha ao notificar handoff:", err);
  }
}
