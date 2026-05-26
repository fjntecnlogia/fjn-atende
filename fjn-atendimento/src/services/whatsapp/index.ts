import { config } from "../../config";
import type { WhatsAppProvider } from "./types";
import { UltraMsgProvider } from "./ultramsg.provider";
import { EvolutionProvider } from "./evolution.provider";
import { WppConnectProvider } from "./wppconnect.provider";

export type { InboundMessage, WhatsAppProvider } from "./types";

let cached: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  switch (config.WHATSAPP_PROVIDER) {
    case "wppconnect":
      cached = new WppConnectProvider({
        baseUrl: config.WPPCONNECT_BASE_URL,
        secretKey: config.WPPCONNECT_SECRET_KEY,
        session: config.WPPCONNECT_SESSION,
        sessionToken: config.WPPCONNECT_SESSION_TOKEN || undefined,
      });
      break;
    case "evolution":
      cached = new EvolutionProvider({
        baseUrl: config.EVOLUTION_BASE_URL,
        apiKey: config.EVOLUTION_API_KEY,
        instance: config.EVOLUTION_INSTANCE,
      });
      break;
    case "ultramsg":
    default:
      cached = new UltraMsgProvider({
        instanceId: config.ULTRAMSG_INSTANCE_ID,
        token: config.ULTRAMSG_TOKEN,
      });
      break;
  }

  console.log(`📞 WhatsApp provider: ${cached.name}`);
  return cached;
}
