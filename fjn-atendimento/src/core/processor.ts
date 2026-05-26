import {
  appendMessage,
  drainBuffer,
  getHistory,
  getOrCreateActiveConversation,
  getOrCreateContact,
  isBotPaused,
} from "./conversation";
import { askAgent } from "./agent";
import { sendHumanized } from "./humanizer";
import { registerHandoff } from "./handoff";
import { config } from "../config";
import { db } from "../db/client";

// Mantém um timer por (tenantId, phone) — debounce
const pendingTimers = new Map<string, NodeJS.Timeout>();
const processingNow = new Set<string>();

function key(tenantId: number, phone: string): string {
  return `${tenantId}:${phone}`;
}

export function scheduleProcessing(tenantId: number, phone: string, name: string | undefined) {
  const k = key(tenantId, phone);
  const existing = pendingTimers.get(k);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(k);
    processIfReady(tenantId, phone, name).catch((err) =>
      console.error(`Erro processando ${k}:`, err),
    );
  }, config.DEBOUNCE_MS);

  pendingTimers.set(k, timer);
}

async function processIfReady(tenantId: number, phone: string, name: string | undefined) {
  const k = key(tenantId, phone);
  if (processingNow.has(k)) {
    scheduleProcessing(tenantId, phone, name);
    return;
  }
  processingNow.add(k);
  try {
    await processPhone(tenantId, phone, name);
  } finally {
    processingNow.delete(k);
  }
}

async function trackUsage(tenantId: number, kind: "messages_sent" | "messages_received", n = 1) {
  await db.query(
    `INSERT INTO tenant_usage (tenant_id, period, ${kind})
     VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2)
     ON CONFLICT (tenant_id, period)
     DO UPDATE SET ${kind} = tenant_usage.${kind} + $2, updated_at = NOW()`,
    [tenantId, n],
  );
}

async function trackAiTokens(tenantId: number, input: number, output: number) {
  await db.query(
    `INSERT INTO tenant_usage (tenant_id, period, ai_input_tokens, ai_output_tokens)
     VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2, $3)
     ON CONFLICT (tenant_id, period)
     DO UPDATE SET
       ai_input_tokens  = tenant_usage.ai_input_tokens  + $2,
       ai_output_tokens = tenant_usage.ai_output_tokens + $3,
       updated_at = NOW()`,
    [tenantId, input, output],
  );
}

async function processPhone(tenantId: number, phone: string, name: string | undefined) {
  const contactId = await getOrCreateContact(tenantId, phone, name);
  const conversation = await getOrCreateActiveConversation(tenantId, contactId);

  const buffered = await drainBuffer(tenantId, phone);
  if (buffered.length === 0) return;

  const combinedUserMessage = buffered.join("\n");
  await appendMessage(tenantId, conversation.id, "user", combinedUserMessage);
  await trackUsage(tenantId, "messages_received");

  if (await isBotPaused(conversation)) {
    console.log(`[t${tenantId} ${phone}] bot pausado — mensagem só registrada.`);
    return;
  }

  const history = await getHistory(tenantId, conversation.id);
  const response = await askAgent(tenantId, history);

  await trackAiTokens(tenantId, response.usage.input, response.usage.output);
  console.log(
    `[t${tenantId} ${phone}] tokens — in:${response.usage.input} out:${response.usage.output} cached:${response.usage.cached}`,
  );

  if (response.handoff) {
    await registerHandoff(
      tenantId,
      conversation.id,
      response.handoff.reason,
      combinedUserMessage,
      phone,
      name ?? null,
    );
  }

  if (response.text) {
    await appendMessage(tenantId, conversation.id, "assistant", response.text);
    await sendHumanized(phone, response.text);
    await trackUsage(tenantId, "messages_sent");
  }
}
