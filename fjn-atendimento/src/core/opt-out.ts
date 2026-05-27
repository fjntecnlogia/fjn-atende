/**
 * Detecção e processamento automático de opt-out.
 *
 * Quando o cliente envia uma mensagem como "PARAR", "SAIR", "STOP", "CANCELAR" etc:
 *   1. Marca opted_out=true em TODAS as listas onde o telefone aparece
 *   2. Cancela próximos envios em campanhas em andamento (recipients pending)
 *   3. Envia mensagem de confirmação ("você foi removido")
 *   4. Registra no log do tenant
 *
 * Por que isso é importante?
 *   - LGPD: cliente tem direito de revogar consentimento
 *   - WhatsApp: ignorar pedidos de "PARAR" leva a bloqueios/banimentos
 *   - Ética: ninguém quer ser spammado
 */

import { db } from "../db/client";
import { getWhatsAppProvider } from "../services/whatsapp";

/**
 * Palavras-chave de opt-out (português + inglês).
 * Match é case-insensitive e considera apenas mensagens "curtas"
 * (até 4 palavras), pra não pegar falsos positivos como
 * "vou parar de comprar aqui agora".
 */
const OPT_OUT_PATTERNS: RegExp[] = [
  /\bparar?\b/i,
  /\bpare\b/i,
  /\bsai[ar]?\b/i,
  /\bstop\b/i,
  /\bcancela[rs]?\b/i,
  /\bcancele[mr]?\b/i,
  /\bremov[ae][rs]?\b/i,
  /\bdesinscrev[ae]r?\b/i,
  /\bdescadastra[rs]?\b/i,
  /\bunsubscribe\b/i,
  /\bn[ãa]o\s+(?:quero|envie|mande|mais)\b/i,
  /\bpa?re?\s+de\s+(?:enviar|mandar)\b/i,
];

/**
 * Detecta se uma mensagem é um pedido de opt-out.
 * Heurística: mensagens curtas (até ~30 chars OU 4 palavras) que contêm keyword.
 */
export function isOptOutMessage(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length === 0) return false;

  // Mensagens muito longas raramente são "stop" — provavelmente é desabafo
  // ou frase real. Só considera curtas.
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5 && trimmed.length > 35) return false;

  return OPT_OUT_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Aplica opt-out: atualiza listas + cancela campanhas pendentes.
 * Retorna estatísticas pra log.
 */
export async function applyOptOut(
  tenantId: number,
  phone: string,
  reason: string = "user_replied_stop",
): Promise<{ lists_updated: number; campaigns_canceled: number }> {
  // 1. Marca opt-out em todas as listas onde o telefone aparece
  const listsRes = await db.query(
    `UPDATE contact_list_items
        SET opted_out = TRUE,
            opted_out_at = NOW(),
            opted_out_reason = $3
      WHERE tenant_id = $1 AND phone = $2 AND opted_out = FALSE
      RETURNING id`,
    [tenantId, phone, reason],
  );

  // 2. Cancela envios pendentes em campanhas em andamento
  const recipientsRes = await db.query(
    `UPDATE campaign_recipients
        SET status = 'opted_out'
      WHERE tenant_id = $1 AND phone = $2 AND status = 'pending'
      RETURNING id, campaign_id`,
    [tenantId, phone],
  );

  // Incrementa counter de opted_out_count nas campanhas afetadas
  if (recipientsRes.rowCount && recipientsRes.rowCount > 0) {
    const campaignIds = [...new Set(recipientsRes.rows.map((r) => r.campaign_id))];
    for (const cId of campaignIds) {
      await db.query(
        `UPDATE campaigns
            SET opted_out_count = opted_out_count + (
              SELECT COUNT(*)::int FROM campaign_recipients
               WHERE campaign_id = $1 AND status = 'opted_out'
                 AND tenant_id = $2
            )
          WHERE id = $1 AND tenant_id = $2`,
        [cId, tenantId],
      );
    }
  }

  const stats = {
    lists_updated: listsRes.rowCount ?? 0,
    campaigns_canceled: recipientsRes.rowCount ?? 0,
  };

  // 3. Log de audit (best-effort)
  try {
    await db.query(
      `INSERT INTO optout_events
        (tenant_id, phone, source, lists_updated_count, campaigns_affected)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, phone, reason, stats.lists_updated, stats.campaigns_canceled],
    );
  } catch { /* tabela pode não existir em dev */ }

  return stats;
}

/**
 * Envia mensagem de confirmação ao cliente que pediu opt-out.
 * Best-effort — falha silenciosa.
 */
export async function sendOptOutConfirmation(phone: string): Promise<void> {
  try {
    const provider = getWhatsAppProvider();
    const msg = [
      "Você foi removido(a) das nossas listas de envio. ✅",
      "",
      "Não enviaremos mais mensagens automáticas. Se mudar de ideia,",
      "é só nos chamar de volta — estaremos por aqui.",
      "",
      "Obrigado!",
    ].join("\n");
    await provider.sendText(phone, msg);
  } catch (err) {
    console.error("Falha enviando confirmação de opt-out:", err);
  }
}

/**
 * Helper que combina detecção + aplicação + confirmação.
 * Retorna `true` se opt-out foi aplicado (chamador deve PARAR o fluxo IA).
 */
export async function handleOptOutIfMatch(
  tenantId: number,
  phone: string,
  text: string,
): Promise<boolean> {
  if (!isOptOutMessage(text)) return false;

  const result = await applyOptOut(tenantId, phone, "user_replied_stop");
  console.log(
    `[opt-out] tenant=${tenantId} phone=${phone} lists=${result.lists_updated} recipients=${result.campaigns_canceled}`,
  );

  // Só envia confirmação se realmente removeu de alguma lista
  // (evita responder a quem nunca esteve em campanha)
  if (result.lists_updated > 0 || result.campaigns_canceled > 0) {
    await sendOptOutConfirmation(phone);
    return true;
  }

  return false;
}
