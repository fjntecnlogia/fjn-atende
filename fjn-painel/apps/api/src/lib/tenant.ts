/**
 * Helpers para trabalhar com tenants.
 *
 * Estratégia: filtramos TENANT_ID explicitamente em todas as queries.
 * RLS no Postgres é a segunda camada (defense-in-depth).
 *
 * Por que não confiar 100% no RLS? O Neon usa connection pooling em modo
 * transaction, o que dificulta `SET LOCAL app.tenant_id` reliably.
 * Filtro explícito é mais simples e seguro.
 */

import { db } from "../db/client";

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: "trial" | "starter" | "pro" | "enterprise";
  status: "active" | "suspended" | "canceled";
  settings: Record<string, unknown>;
  branding: Record<string, unknown>;
  ai_persona: Record<string, unknown>;
  prompt_master: string | null;
  notify_phone: string | null;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function getTenant(id: number): Promise<Tenant | null> {
  const r = await db.query<Tenant>(
    `SELECT * FROM tenants WHERE id = $1`,
    [id],
  );
  return r.rowCount && r.rowCount > 0 ? r.rows[0] : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const r = await db.query<Tenant>(
    `SELECT * FROM tenants WHERE slug = $1`,
    [slug.toLowerCase()],
  );
  return r.rowCount && r.rowCount > 0 ? r.rows[0] : null;
}

/**
 * Resolve qual tenant é dono de uma sessão WhatsApp.
 * Usado pelo fjn-atendimento quando chega webhook do WPP-Connect.
 */
export async function findTenantByWhatsAppSession(sessionName: string): Promise<number | null> {
  const r = await db.query<{ tenant_id: number }>(
    `SELECT tenant_id FROM whatsapp_instances WHERE session_name = $1 AND status != 'error'`,
    [sessionName],
  );
  return r.rowCount && r.rowCount > 0 ? r.rows[0].tenant_id : null;
}

/**
 * Verifica se o tenant está ativo e não atingiu limite de plano.
 */
export async function isTenantOperational(tenantId: number): Promise<{ ok: boolean; reason?: string }> {
  const r = await db.query(
    `SELECT t.status, t.plan, p.max_messages_month
       FROM tenants t
       JOIN plans p ON p.slug = t.plan
      WHERE t.id = $1`,
    [tenantId],
  );
  if (r.rowCount === 0) return { ok: false, reason: "tenant não encontrado" };
  const row = r.rows[0];
  if (row.status !== "active") return { ok: false, reason: `tenant ${row.status}` };

  // Verifica limite de mensagens do mês corrente
  if (row.max_messages_month && row.max_messages_month > 0) {
    const usage = await db.query<{ total: number }>(
      `SELECT COALESCE(messages_sent + messages_received, 0) AS total
         FROM tenant_usage
        WHERE tenant_id = $1
          AND period = date_trunc('month', CURRENT_DATE)::date`,
      [tenantId],
    );
    const total = usage.rows[0]?.total ?? 0;
    if (total >= row.max_messages_month) {
      return { ok: false, reason: `limite do plano atingido (${total}/${row.max_messages_month} mensagens)` };
    }
  }
  return { ok: true };
}

/**
 * Incrementa contador de uso (chamado a cada mensagem processada).
 */
export async function incrementUsage(
  tenantId: number,
  field: "messages_sent" | "messages_received" | "conversations",
  by = 1,
): Promise<void> {
  await db.query(
    `INSERT INTO tenant_usage (tenant_id, period, ${field})
     VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2)
     ON CONFLICT (tenant_id, period)
     DO UPDATE SET ${field} = tenant_usage.${field} + $2, updated_at = NOW()`,
    [tenantId, by],
  );
}

export async function trackAiTokens(
  tenantId: number,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await db.query(
    `INSERT INTO tenant_usage (tenant_id, period, ai_input_tokens, ai_output_tokens)
     VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2, $3)
     ON CONFLICT (tenant_id, period)
     DO UPDATE SET
       ai_input_tokens  = tenant_usage.ai_input_tokens  + $2,
       ai_output_tokens = tenant_usage.ai_output_tokens + $3,
       updated_at = NOW()`,
    [tenantId, inputTokens, outputTokens],
  );
}
