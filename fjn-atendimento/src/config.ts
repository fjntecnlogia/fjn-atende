import "dotenv/config";
import { z } from "zod";

/**
 * Validação por provider — só exige campos do provider escolhido.
 */
const baseSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  WHATSAPP_PROVIDER: z.enum(["ultramsg", "evolution", "wppconnect"]).default("wppconnect"),
  WEBHOOK_TOKEN: z.string().min(8).optional(),
  // legado — mantido para compat com .env antigos
  ULTRAMSG_WEBHOOK_TOKEN: z.string().min(8).optional(),

  // UltraMsg (opcional — só obrigatório se provider=ultramsg)
  ULTRAMSG_INSTANCE_ID: z.string().optional().default(""),
  ULTRAMSG_TOKEN: z.string().optional().default(""),

  // Evolution API (opcional — só obrigatório se provider=evolution)
  EVOLUTION_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  EVOLUTION_API_KEY: z.string().optional().default(""),
  EVOLUTION_INSTANCE: z.string().optional().default("fjn-atendimento"),

  // WPP-Connect (opcional — só obrigatório se provider=wppconnect)
  WPPCONNECT_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  WPPCONNECT_SECRET_KEY: z.string().optional().default(""),
  WPPCONNECT_SESSION: z.string().optional().default("fjn-atendimento"),
  WPPCONNECT_SESSION_TOKEN: z.string().optional().default(""),

  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),

  DATABASE_URL: z.string().url(),

  DEBOUNCE_MS: z.coerce.number().default(3000),
  TYPING_CHARS_PER_SEC: z.coerce.number().default(20),
  HISTORY_LIMIT: z.coerce.number().default(20),
  HANDOFF_NOTIFY_PHONE: z.string().min(10),
  HANDOFF_PAUSE_MINUTES: z.coerce.number().default(60),
});

const parsed = baseSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

const c = parsed.data;

// Normaliza WEBHOOK_TOKEN (aceita o legado ULTRAMSG_WEBHOOK_TOKEN)
const webhookToken = c.WEBHOOK_TOKEN ?? c.ULTRAMSG_WEBHOOK_TOKEN;
if (!webhookToken) {
  console.error("❌ Defina WEBHOOK_TOKEN (ou ULTRAMSG_WEBHOOK_TOKEN para compat).");
  process.exit(1);
}

// Validações condicionais por provider
if (c.WHATSAPP_PROVIDER === "ultramsg") {
  if (!c.ULTRAMSG_INSTANCE_ID || !c.ULTRAMSG_TOKEN) {
    console.error("❌ WHATSAPP_PROVIDER=ultramsg requer ULTRAMSG_INSTANCE_ID e ULTRAMSG_TOKEN.");
    process.exit(1);
  }
}
if (c.WHATSAPP_PROVIDER === "evolution") {
  if (!c.EVOLUTION_BASE_URL || !c.EVOLUTION_API_KEY) {
    console.error("❌ WHATSAPP_PROVIDER=evolution requer EVOLUTION_BASE_URL e EVOLUTION_API_KEY.");
    process.exit(1);
  }
}
if (c.WHATSAPP_PROVIDER === "wppconnect") {
  if (!c.WPPCONNECT_BASE_URL || !c.WPPCONNECT_SECRET_KEY) {
    console.error("❌ WHATSAPP_PROVIDER=wppconnect requer WPPCONNECT_BASE_URL e WPPCONNECT_SECRET_KEY.");
    process.exit(1);
  }
}

export const config = {
  ...c,
  WEBHOOK_TOKEN: webhookToken,
};
