import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES: z.string().default("7d"),
  WEB_URL: z.string().url(),
  ATENDIMENTO_PATH: z.string().default("/opt/fjn-atendimento"),

  // Provider selecionável (espelha fjn-atendimento)
  WHATSAPP_PROVIDER: z.enum(["ultramsg", "evolution", "wppconnect"]).default("wppconnect"),

  // UltraMsg (opcional)
  ULTRAMSG_INSTANCE_ID: z.string().optional().default(""),
  ULTRAMSG_TOKEN: z.string().optional().default(""),

  // Evolution (opcional)
  EVOLUTION_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  EVOLUTION_API_KEY: z.string().optional().default(""),
  EVOLUTION_INSTANCE: z.string().optional().default("fjn-atendimento"),

  // WPP-Connect (opcional)
  WPPCONNECT_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  WPPCONNECT_SECRET_KEY: z.string().optional().default(""),
  WPPCONNECT_SESSION: z.string().optional().default("fjn-atendimento"),
  WPPCONNECT_SESSION_TOKEN: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Variáveis inválidas:", parsed.error.format());
  process.exit(1);
}

const c = parsed.data;

if (c.WHATSAPP_PROVIDER === "ultramsg" && (!c.ULTRAMSG_INSTANCE_ID || !c.ULTRAMSG_TOKEN)) {
  console.error("❌ WHATSAPP_PROVIDER=ultramsg requer ULTRAMSG_INSTANCE_ID e ULTRAMSG_TOKEN.");
  process.exit(1);
}
if (c.WHATSAPP_PROVIDER === "evolution" && (!c.EVOLUTION_BASE_URL || !c.EVOLUTION_API_KEY)) {
  console.error("❌ WHATSAPP_PROVIDER=evolution requer EVOLUTION_BASE_URL e EVOLUTION_API_KEY.");
  process.exit(1);
}
if (c.WHATSAPP_PROVIDER === "wppconnect" && (!c.WPPCONNECT_BASE_URL || !c.WPPCONNECT_SECRET_KEY)) {
  console.error("❌ WHATSAPP_PROVIDER=wppconnect requer WPPCONNECT_BASE_URL e WPPCONNECT_SECRET_KEY.");
  process.exit(1);
}

export const config = c;
