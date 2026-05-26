/**
 * Helper de envio WhatsApp pelo painel admin.
 * Suporta UltraMsg, Evolution API e WPP-Connect via WHATSAPP_PROVIDER.
 * Nome do arquivo mantido por compat com imports antigos.
 */
import axios from "axios";
import { config } from "../config";

function formatNumber(to: string): string {
  return to.replace(/\D/g, "");
}

async function sendUltraMsg(to: string, body: string) {
  await axios.post(
    `https://api.ultramsg.com/${config.ULTRAMSG_INSTANCE_ID}/messages/chat`,
    null,
    {
      params: { token: config.ULTRAMSG_TOKEN, to: formatNumber(to), body },
      timeout: 15_000,
    },
  );
}

async function sendEvolution(to: string, body: string) {
  await axios.post(
    `${config.EVOLUTION_BASE_URL!.replace(/\/$/, "")}/message/sendText/${config.EVOLUTION_INSTANCE}`,
    { number: formatNumber(to), text: body, delay: 0, linkPreview: false },
    {
      headers: { apikey: config.EVOLUTION_API_KEY!, "Content-Type": "application/json" },
      timeout: 15_000,
    },
  );
}

let wppToken: string | null = null;
async function ensureWppToken(): Promise<string> {
  if (wppToken) return wppToken;
  if (config.WPPCONNECT_SESSION_TOKEN) {
    wppToken = config.WPPCONNECT_SESSION_TOKEN;
    return wppToken;
  }
  const r = await axios.post(
    `${config.WPPCONNECT_BASE_URL!.replace(/\/$/, "")}/api/${config.WPPCONNECT_SESSION}/${config.WPPCONNECT_SECRET_KEY}/generate-token`,
    null,
    { timeout: 10_000 },
  );
  const t = r.data?.token ?? r.data?.full?.replace(/^Bearer /, "");
  if (!t) throw new Error("WPP-Connect: falha ao gerar token no painel");
  wppToken = t;
  return wppToken!;
}

async function sendWppConnect(to: string, body: string) {
  const token = await ensureWppToken();
  await axios.post(
    `${config.WPPCONNECT_BASE_URL!.replace(/\/$/, "")}/api/${config.WPPCONNECT_SESSION}/send-message`,
    { phone: formatNumber(to), message: body, isGroup: false },
    {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: 15_000,
    },
  );
}

export async function sendText(to: string, body: string) {
  switch (config.WHATSAPP_PROVIDER) {
    case "wppconnect": return sendWppConnect(to, body);
    case "evolution":  return sendEvolution(to, body);
    case "ultramsg":   return sendUltraMsg(to, body);
  }
}
