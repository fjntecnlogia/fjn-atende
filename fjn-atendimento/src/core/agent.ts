import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import { db } from "../db/client";
import type { MessageRow } from "./conversation";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// Prompt base padrão (fallback). O tenant pode sobrescrever com prompt_master.
const promptsDir = path.join(__dirname, "..", "prompts");
let defaultSystemMaster = "";
try {
  defaultSystemMaster = fs.readFileSync(path.join(promptsDir, "system-master.md"), "utf-8");
} catch {
  defaultSystemMaster = "Você é um atendente profissional e prestativo.";
}

// Cache em memória por tenant
interface TenantContext { fullPrompt: string; loadedAt: number; }
const cache = new Map<number, TenantContext>();
const TTL_MS = 60_000;

async function buildTenantPrompt(tenantId: number): Promise<string> {
  const tRes = await db.query<{
    name: string;
    ai_persona: any;
    prompt_master: string | null;
  }>(
    `SELECT name, ai_persona, prompt_master FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (tRes.rowCount === 0) throw new Error(`Tenant ${tenantId} não encontrado`);
  const t = tRes.rows[0];

  const kRes = await db.query<{ title: string; content: string }>(
    `SELECT title, content FROM tenant_knowledge
      WHERE tenant_id = $1 AND enabled = TRUE
      ORDER BY position, id`,
    [tenantId],
  );

  const persona = t.ai_persona ?? {};
  const personaName = persona.name ?? "Atendente";
  const personaTone = persona.tone ?? "caloroso e profissional";

  const header = `# Você é ${personaName}
Atendente da empresa **${t.name}**.
Estilo: ${personaTone}.

**Você NUNCA diz que é uma IA, bot ou assistente virtual.** Se perguntarem, responda: "Sou ${personaName} do time de atendimento. Em que posso te ajudar?". Não minta — apenas não introduza o assunto.
`;

  const masterPrompt = t.prompt_master?.trim() || defaultSystemMaster;

  const knowledgeBlocks = kRes.rows
    .map((k) => `\n\n=================================\n# ${k.title}\n=================================\n${k.content}`)
    .join("");

  return `${header}\n\n${masterPrompt}${knowledgeBlocks}`;
}

async function getTenantContext(tenantId: number): Promise<TenantContext> {
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  const fullPrompt = await buildTenantPrompt(tenantId);
  const ctx = { fullPrompt, loadedAt: Date.now() };
  cache.set(tenantId, ctx);
  return ctx;
}

export function invalidateTenantContext(tenantId: number) {
  cache.delete(tenantId);
}

// ----------------------------------------------------------------------

export interface AgentResponse {
  text: string;
  handoff?: { reason: string };
  usage: { input: number; output: number; cached: number };
}

export async function askAgent(tenantId: number, history: MessageRow[]): Promise<AgentResponse> {
  const ctx = await getTenantContext(tenantId);

  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: ctx.fullPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const block = response.content[0];
  const text = block.type === "text" ? block.text : "";

  const handoffMatch = text.match(/^\[HANDOFF:\s*([^\]]+)\]\s*/);
  const handoff = handoffMatch ? { reason: handoffMatch[1].trim() } : undefined;
  const cleanText = handoff ? text.replace(handoffMatch![0], "").trim() : text.trim();

  return {
    text: cleanText,
    handoff,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cached: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}
