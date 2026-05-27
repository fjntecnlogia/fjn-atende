import { db } from "../db/client";
import { config } from "../config";

export type Role = "user" | "assistant" | "system" | "human_agent";

export interface MessageRow {
  role: Role;
  content: string;
  sent_at: Date;
}

// =====================================================================
// CONTACT
// =====================================================================

export async function getOrCreateContact(
  tenantId: number,
  phone: string,
  name?: string,
): Promise<number> {
  const existing = await db.query(
    `SELECT id, name FROM contacts WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    await db.query(
      `UPDATE contacts SET last_seen = NOW(), name = COALESCE($2, name)
        WHERE id = $1`,
      [existing.rows[0].id, name ?? null],
    );
    return existing.rows[0].id;
  }
  const inserted = await db.query(
    `INSERT INTO contacts (tenant_id, phone, name) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, phone, name ?? null],
  );
  return inserted.rows[0].id;
}

// =====================================================================
// CONVERSATION
// =====================================================================

export async function getOrCreateActiveConversation(tenantId: number, contactId: number) {
  const existing = await db.query(
    `SELECT id, bot_paused_until, status
       FROM conversations
      WHERE tenant_id = $1 AND contact_id = $2 AND status = 'active'
      ORDER BY id DESC LIMIT 1`,
    [tenantId, contactId],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0] as {
      id: number;
      bot_paused_until: Date | null;
      status: string;
    };
  }
  const created = await db.query(
    `INSERT INTO conversations (tenant_id, contact_id)
     VALUES ($1, $2)
     RETURNING id, bot_paused_until, status`,
    [tenantId, contactId],
  );

  // Auto-cria card no pipeline default do tenant (FUNIL CRM)
  // Não bloqueia o fluxo se falhar (try/catch silencioso)
  try {
    await db.query(
      `SELECT create_default_card_for_conversation($1, $2)`,
      [created.rows[0].id, tenantId],
    );
  } catch (err: any) {
    console.warn(`[funnel] Falha ao auto-criar card conv=${created.rows[0].id}:`, err.message);
  }

  return created.rows[0];
}

// =====================================================================
// MESSAGES
// =====================================================================

export async function appendMessage(
  tenantId: number,
  conversationId: number,
  role: Role,
  content: string,
) {
  await db.query(
    `INSERT INTO messages (tenant_id, conversation_id, role, content)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, conversationId, role, content],
  );
  await db.query(
    `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
    [conversationId],
  );
}

export async function getHistory(
  tenantId: number,
  conversationId: number,
): Promise<MessageRow[]> {
  const result = await db.query<MessageRow>(
    `SELECT role, content, sent_at
       FROM messages
      WHERE tenant_id = $1 AND conversation_id = $2
        AND role IN ('user', 'assistant')
      ORDER BY id DESC
      LIMIT $3`,
    [tenantId, conversationId, config.HISTORY_LIMIT],
  );
  return result.rows.reverse();
}

// =====================================================================
// PAUSE / STATUS
// =====================================================================

export async function pauseBot(conversationId: number, minutes: number) {
  if (minutes <= 0) {
    await db.query(
      `UPDATE conversations SET bot_paused_until = NULL, status = 'paused' WHERE id = $1`,
      [conversationId],
    );
  } else {
    await db.query(
      `UPDATE conversations
          SET bot_paused_until = NOW() + ($2 || ' minutes')::interval
        WHERE id = $1`,
      [conversationId, minutes],
    );
  }
}

export async function isBotPaused(conversation: {
  bot_paused_until: Date | null;
  status: string;
}) {
  if (conversation.status === "paused") return true;
  if (!conversation.bot_paused_until) return false;
  return new Date(conversation.bot_paused_until).getTime() > Date.now();
}

// =====================================================================
// BUFFER de mensagens (debounce)
// =====================================================================

export async function bufferMessage(tenantId: number, phone: string, content: string) {
  await db.query(
    `INSERT INTO message_buffer (tenant_id, phone, content) VALUES ($1, $2, $3)`,
    [tenantId, phone, content],
  );
}

export async function drainBuffer(tenantId: number, phone: string): Promise<string[]> {
  const result = await db.query<{ id: number; content: string }>(
    `SELECT id, content FROM message_buffer
      WHERE tenant_id = $1 AND phone = $2 AND processed = FALSE
      ORDER BY id ASC`,
    [tenantId, phone],
  );
  if (result.rowCount === 0) return [];
  const ids = result.rows.map((r) => r.id);
  await db.query(
    `UPDATE message_buffer SET processed = TRUE WHERE id = ANY($1::bigint[])`,
    [ids],
  );
  return result.rows.map((r) => r.content);
}
