/**
 * Worker de onboarding emails — 3 toques.
 *
 * Dia 0 (signup): welcome — disparado pelo /auth/signup
 * Dia 3:          dicas de configuração — disparado por este worker
 * Dia 7:          push pra plano (ou engajamento se já pago) — disparado por este worker
 *
 * Roda 1x por hora. Idempotente: marca timestamp na tenants quando envia.
 */

import { db } from "../db/client";
import { sendOnboardingDay3Email, sendOnboardingDay7Email } from "../lib/email";

const TICK_INTERVAL_MS = 60 * 60 * 1000;  // 1 hora

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startOnboardingWorker() {
  console.log("📬 Onboarding worker iniciado (tick 1h)");
  // primeira execução em 90s pra não atropelar boot
  setTimeout(() => runTick(), 90_000);
  timer = setInterval(runTick, TICK_INTERVAL_MS);
}

export function stopOnboardingWorker() {
  if (timer) clearInterval(timer);
}

function runTick() {
  if (running) return;
  running = true;
  tick()
    .catch((err) => console.error("Onboarding worker error:", err))
    .finally(() => { running = false; });
}

async function tick(): Promise<void> {
  // Dia 3 — tenants criados há >= 3 dias, ainda sem day3 enviado
  const day3 = await db.query(
    `SELECT t.id, t.name, t.email, u.email AS owner_email, u.name AS owner_name
       FROM tenants t
       LEFT JOIN admin_users u ON u.tenant_id = t.id AND u.role = 'owner'
      WHERE t.day3_email_sent_at IS NULL
        AND t.created_at <= NOW() - INTERVAL '3 days'
        AND t.created_at >= NOW() - INTERVAL '60 days'  -- limite: não dispara retroativo > 60d
        AND t.status NOT IN ('canceled', 'suspended')`,
  );

  for (const row of day3.rows) {
    const to = row.owner_email ?? row.email;
    if (!to) {
      // Marca como enviado mesmo sem destinatário pra não tentar de novo
      await db.query(`UPDATE tenants SET day3_email_sent_at = NOW() WHERE id = $1`, [row.id]);
      continue;
    }
    try {
      await sendOnboardingDay3Email({
        to,
        userName: row.owner_name ?? "Cliente",
        tenantName: row.name,
      });
      await db.query(`UPDATE tenants SET day3_email_sent_at = NOW() WHERE id = $1`, [row.id]);
      console.log(`📬 [day3] enviado → ${to} (tenant=${row.id})`);
    } catch (err: any) {
      console.error(`📬 [day3] falha tenant=${row.id}:`, err.message);
    }
  }

  // Dia 7 — tenants criados há >= 7 dias, ainda sem day7 enviado
  const day7 = await db.query(
    `SELECT t.id, t.name, t.email, t.status,
            u.email AS owner_email, u.name AS owner_name,
            (SELECT status FROM tenant_subscriptions WHERE tenant_id = t.id LIMIT 1) AS sub_status
       FROM tenants t
       LEFT JOIN admin_users u ON u.tenant_id = t.id AND u.role = 'owner'
      WHERE t.day7_email_sent_at IS NULL
        AND t.created_at <= NOW() - INTERVAL '7 days'
        AND t.created_at >= NOW() - INTERVAL '90 days'
        AND t.status NOT IN ('canceled', 'suspended')`,
  );

  for (const row of day7.rows) {
    const to = row.owner_email ?? row.email;
    if (!to) {
      await db.query(`UPDATE tenants SET day7_email_sent_at = NOW() WHERE id = $1`, [row.id]);
      continue;
    }
    try {
      await sendOnboardingDay7Email({
        to,
        userName: row.owner_name ?? "Cliente",
        tenantName: row.name,
        hasActivePlan: row.sub_status === "active",
      });
      await db.query(`UPDATE tenants SET day7_email_sent_at = NOW() WHERE id = $1`, [row.id]);
      console.log(`📬 [day7] enviado → ${to} (tenant=${row.id}, ativo=${row.sub_status === "active"})`);
    } catch (err: any) {
      console.error(`📬 [day7] falha tenant=${row.id}:`, err.message);
    }
  }
}
