import { getWhatsAppProvider } from "../services/whatsapp";
import { config } from "../config";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function splitIntoMessages(text: string): string[] {
  return text
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function typingDelay(text: string): number {
  const seconds = text.length / config.TYPING_CHARS_PER_SEC;
  // Mínimo 800ms, máximo 6s, com leve variação aleatória
  const clamped = Math.min(Math.max(seconds * 1000, 800), 6000);
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.round(clamped * jitter);
}

export async function sendHumanized(to: string, fullText: string) {
  const provider = getWhatsAppProvider();
  const parts = splitIntoMessages(fullText);
  for (let i = 0; i < parts.length; i++) {
    const msg = parts[i];
    await provider.sendTypingPresence(to);
    await sleep(typingDelay(msg));
    await provider.sendText(to, msg);
    if (i < parts.length - 1) {
      await sleep(400 + Math.random() * 600);
    }
  }
}
