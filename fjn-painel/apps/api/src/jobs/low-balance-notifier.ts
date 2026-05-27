/**
 * Job de alerta de saldo baixo.
 *
 * Roda 1x por hora (configurável). Para cada tenant cujo saldo caiu abaixo
 * do threshold configurado em tenant_credits.low_balance_threshold_cents:
 *   1. Verifica se já avisamos nas últimas 24h (dedup por low_balance_notified_at)
 *   2. Envia e-mail pro owner
 *   3. Marca low_balance_notified_at = NOW()
 *
 * Se o saldo voltar a subir acima do threshold, o flag é resetado (na recarga
 * via add_credits, mas como fallback este job também reseta quando vê saldo OK).
 */

import { db } from "../db/client";
import { sendLowBalanceEmail } from "../lib/email";

const TICK_INTERVAL_MS = 60 * 60 * 1000;  // 1 hora
const DEDUP_HOURS = 24;                    // não reenviar dentro de 24h

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startLowBalanceWorker() {
  console.log("💰 Low-balance worker iniciado (tick 1h)");
  // primeira execução depois de 60s pra não atropelar o boot
  setTimeout(() => runTick(), 60_000);
  timer = setInterval(runTick, TICK_INTERVAL_MS);
}

export function stopLowBalanceWorker() {
  if (timer) clearInterval(timer);
}

function runTick() {
  if (running) return;
  running = true;
  tick()
    .catch((err) => console.error("low-balance worker error:", err))
    .finally(() => { running = false; });
}

async function tick(): Promise<void> {
  // Busca tenants com saldo abaixo do threshold e que não foram notificados nas últimas 24h
  // (colunas vêm da migration 09_low_balance_alert.sql)
  const lowBalances = await db.query(
    `SELECT tc.tenant_id, tc.balance_cents, tc.low_balance_threshold_cents
       FROM tenant_credits tc
       JOIN tenants t ON t.id = tc.tenant_id
      WHERE tc.balance_cents < tc.low_balance_threshold_cents
        AND tc.balance_cents >= 0
        AND t.status = 'active'
        AND (
              tc.low_balance_notified_at IS NULL
           OR tc.low_balance_notified_at < NOW() - INTERVAL '${DEDUP_HOURS} hours'
        )`,
  );

  if (lowBalances.rowCount === 0) {
    // Reset opcional pra tenants que recuperaram (mantém histórico limpo)
    await db.query(
      `UPDATE tenant_credits
          SET low_balance_notified_at = NULL
        WHERE balance_cents >= low_balance_threshold_cents
          AND low_balance_notified_at IS NOT NULL`,
    );
    return;
  }

  for (const row of lowBalances.rows) {
    try {
      // Owner do tenant
      const ownerQ = await db.query(
        `SELECT email, name FROM admin_users
          WHERE tenant_id = $1 AND role = 'owner'
          ORDER BY id ASC LIMIT 1`,
        [row.tenant_id],
      );
      const owner = ownerQ.rows[0];
      if (!owner) continue;

      await sendLowBalanceEmail({
        to: owner.email,
        userName: owner.name,
        balanceCents: Number(row.balance_cents),
        thresholdCents: Number(row.low_balance_threshold_cents),
      });

      await db.query(
        `UPDATE tenant_credits
            SET low_balance_notified_at = NOW()
          WHERE tenant_id = $1`,
        [row.tenant_id],
      );

      console.log(`💰 Alerta saldo baixo enviado: tenant=${row.tenant_id} balance=${row.balance_cents}`);
    } catch (err: any) {
      console.error(`low-balance: falha tenant=${row.tenant_id}:`, err.message);
    }
  }
}
