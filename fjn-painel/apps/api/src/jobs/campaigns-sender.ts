/**
 * Worker de envio de campanhas.
 *
 * Roda em loop no mesmo processo do painel-api (não exige container extra).
 * A cada N segundos:
 *   1. Pega campanhas em status='running' ou 'scheduled' (com scheduled_at <= NOW)
 *   2. Pra cada campanha: pega até `rate_per_min/12` destinatários pendentes
 *      (12 = ticks por minuto a cada 5s)
 *   3. Envia via provider apropriado
 *   4. Debita crédito do tenant
 *   5. Atualiza status
 *
 * Rate-limit anti-ban:
 *   - Respeita rate_per_min da campanha
 *   - Aplica jitter aleatório entre envios
 *   - Auto-pause se taxa de falha > auto_pause_on_block_pct
 */

import axios from "axios";
import { db } from "../db/client";
import { config } from "../config";

const TICK_INTERVAL_MS = 5_000;
const TICKS_PER_MINUTE = 60_000 / TICK_INTERVAL_MS;  // 12

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startCampaignWorker() {
  console.log("📢 Campaign worker iniciado (tick 5s)");
  timer = setInterval(() => {
    if (running) return;
    running = true;
    tick().catch((err) => console.error("Campaign worker error:", err)).finally(() => {
      running = false;
    });
  }, TICK_INTERVAL_MS);
}

export function stopCampaignWorker() {
  if (timer) clearInterval(timer);
}

async function tick() {
  // 1. Promover scheduled → running se chegou a hora
  await db.query(
    `UPDATE campaigns
        SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
      WHERE status = 'scheduled' AND scheduled_at <= NOW()`,
  );

  // 2. Lista campanhas ativas
  const campaigns = await db.query<{
    id: number;
    tenant_id: number;
    provider: string;
    instance_id: number | null;
    rate_per_min: number;
    jitter_seconds: number;
    auto_pause_on_block_pct: number | null;
    total_count: number;
    failed_count: number;
  }>(
    `SELECT id, tenant_id, provider, instance_id, rate_per_min, jitter_seconds,
            auto_pause_on_block_pct, total_count, failed_count
       FROM campaigns
      WHERE status = 'running'
      ORDER BY id`,
  );

  for (const c of campaigns.rows) {
    await processCampaign(c).catch((err) =>
      console.error(`[campaign ${c.id}] tick error:`, err.message),
    );
  }
}

async function processCampaign(c: any): Promise<void> {
  // Auto-pause se taxa de falha excedeu
  if (c.total_count > 20 && c.auto_pause_on_block_pct) {
    const failurePct = (c.failed_count / c.total_count) * 100;
    if (failurePct >= Number(c.auto_pause_on_block_pct)) {
      await db.query(
        `UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
        [c.id],
      );
      console.warn(`[campaign ${c.id}] auto-pausada — taxa de falha ${failurePct.toFixed(1)}%`);
      return;
    }
  }

  // Quantos enviar nessa rodada (rate_per_min / 12)
  const batchSize = Math.max(1, Math.floor(c.rate_per_min / TICKS_PER_MINUTE));

  // Pega N pendentes
  const recipients = await db.query(
    `SELECT id, phone, name, rendered_body
       FROM campaign_recipients
      WHERE campaign_id = $1 AND status = 'pending'
      ORDER BY id
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
    [c.id, batchSize],
  );

  if (recipients.rowCount === 0) {
    // Sem mais pendentes — marcar como completed
    const pendingCheck = await db.query(
      `SELECT COUNT(*)::int AS n FROM campaign_recipients
        WHERE campaign_id = $1 AND status IN ('pending','queued','sending')`,
      [c.id],
    );
    if (pendingCheck.rows[0].n === 0) {
      await db.query(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'running'`,
        [c.id],
      );
      console.log(`[campaign ${c.id}] completa`);
    }
    return;
  }

  // Marca como "sending" pra evitar dupla
  const ids = recipients.rows.map((r) => r.id);
  await db.query(
    `UPDATE campaign_recipients SET status = 'sending', attempts = attempts + 1
      WHERE id = ANY($1::bigint[])`,
    [ids],
  );

  // Envia cada um (sequencial, com jitter)
  for (const r of recipients.rows) {
    await sendOne(c, r).catch((err) =>
      console.error(`[campaign ${c.id}] recipient ${r.id} erro:`, err.message),
    );
    // Jitter aleatório entre 0 e jitter_seconds
    if (c.jitter_seconds > 0) {
      const jitter = Math.random() * c.jitter_seconds * 1000;
      await new Promise((res) => setTimeout(res, jitter));
    }
  }
}

async function sendOne(c: any, r: any): Promise<void> {
  // 1. Verifica saldo e debita
  const priceRes = await db.query<{ price_cents: number }>(
    `SELECT price_cents FROM message_pricing
      WHERE active = TRUE
        AND provider = $1
        AND (tenant_id = $2 OR tenant_id IS NULL)
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY tenant_id NULLS LAST LIMIT 1`,
    [c.provider, c.tenant_id],
  );
  const priceCents = priceRes.rows[0]?.price_cents ?? 5;

  const debit = await db.query<{ success: boolean; balance_after: number }>(
    `SELECT * FROM debit_credits($1, $2, $3, $4, $5)`,
    [c.tenant_id, priceCents, `Campanha #${c.id} → ${r.phone}`, c.id, r.id],
  );
  if (!debit.rows[0].success) {
    // Sem saldo — pausa campanha
    await db.query(
      `UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
      [c.id],
    );
    await db.query(
      `UPDATE campaign_recipients
          SET status = 'pending', failed_reason = 'saldo insuficiente'
        WHERE id = $1`,
      [r.id],
    );
    console.warn(`[campaign ${c.id}] pausada — saldo insuficiente`);
    return;
  }

  // 2. Envia mensagem
  try {
    const externalId = await sendViaProvider(c, r);
    await db.query(
      `UPDATE campaign_recipients
          SET status = 'sent', external_id = $2, sent_at = NOW()
        WHERE id = $1`,
      [r.id, externalId],
    );
    await db.query(
      `UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
      [c.id],
    );
    await db.query(
      `INSERT INTO tenant_usage (tenant_id, period, campaign_messages_sent)
       VALUES ($1, date_trunc('month', CURRENT_DATE)::date, 1)
       ON CONFLICT (tenant_id, period)
       DO UPDATE SET campaign_messages_sent = tenant_usage.campaign_messages_sent + 1`,
      [c.tenant_id],
    );
  } catch (err: any) {
    // Refund: devolve crédito
    await db.query(
      `SELECT add_credits($1, $2, 'refund', $3, NULL, NULL, NULL)`,
      [c.tenant_id, priceCents, `Refund: falha envio campanha #${c.id} → ${r.phone}`],
    );
    await db.query(
      `UPDATE campaign_recipients
          SET status = 'failed', failed_reason = $2, failed_at = NOW()
        WHERE id = $1`,
      [r.id, err.message?.substring(0, 500) ?? "erro desconhecido"],
    );
    await db.query(
      `UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
      [c.id],
    );
  }
}

async function sendViaProvider(c: any, r: any): Promise<string | null> {
  if (c.provider === "wppconnect") {
    return sendWppConnect(c, r);
  }
  if (c.provider === "meta_cloud") {
    return sendMetaCloud(c, r);
  }
  throw new Error(`Provider ${c.provider} não suportado pelo worker ainda`);
}

async function sendWppConnect(c: any, r: any): Promise<string | null> {
  // Busca a instância do tenant
  let instance: any;
  if (c.instance_id) {
    const ri = await db.query(
      `SELECT * FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [c.instance_id, c.tenant_id],
    );
    instance = ri.rows[0];
  } else {
    const ri = await db.query(
      `SELECT * FROM whatsapp_instances WHERE tenant_id = $1 AND status = 'connected' ORDER BY id LIMIT 1`,
      [c.tenant_id],
    );
    instance = ri.rows[0];
  }
  if (!instance) throw new Error("Sem instância WhatsApp conectada");

  const phone = r.phone.replace(/\D/g, "");
  const resp = await axios.post(
    `${config.WPPCONNECT_BASE_URL}/api/${instance.session_name}/send-message`,
    {
      phone,
      message: r.rendered_body,
      isGroup: false,
    },
    {
      headers: {
        Authorization: `Bearer ${instance.session_token}`,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    },
  );

  return resp.data?.id ?? resp.data?.response?.id ?? null;
}

async function sendMetaCloud(_c: any, _r: any): Promise<string | null> {
  // TODO: implementar quando configurarmos Meta Cloud API
  throw new Error("Meta Cloud ainda não implementado — aguarda config de tenant_meta_cloud");
}
