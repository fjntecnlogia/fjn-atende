import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import type { InboundMessage, WhatsAppProvider } from "./types";

export interface UltraMsgConfig {
  instanceId: string;
  token: string;
}

const payloadSchema = z.object({
  event_type: z.string().optional(),
  instanceId: z.string().optional(),
  data: z.object({
    id: z.string().optional(),
    from: z.string(),
    to: z.string().optional(),
    body: z.string().optional().default(""),
    type: z.string().optional(),
    media: z.string().optional(),
    caption: z.string().optional(),
    fromMe: z.boolean().optional(),
    pushname: z.string().optional(),
    time: z.number().optional(),
  }),
});

function extractPhone(raw: string): string {
  return raw.split("@")[0];
}

function mapType(t: string | undefined): InboundMessage["type"] {
  switch ((t ?? "chat").toLowerCase()) {
    case "chat":     return "chat";
    case "ptt":      return "audio";
    case "audio":    return "audio";
    case "image":    return "image";
    case "video":    return "video";
    case "document": return "document";
    case "location": return "location";
    case "vcard":    return "contact";
    case "sticker":  return "sticker";
    default:         return "unknown";
  }
}

export class UltraMsgProvider implements WhatsAppProvider {
  readonly name = "ultramsg";
  private http: AxiosInstance;
  private token: string;

  constructor(cfg: UltraMsgConfig) {
    this.token = cfg.token;
    this.http = axios.create({
      baseURL: `https://api.ultramsg.com/${cfg.instanceId}`,
      timeout: 15_000,
    });
  }

  async sendText(to: string, body: string): Promise<void> {
    await this.http.post("/messages/chat", null, {
      params: { token: this.token, to, body },
    });
  }

  async sendTypingPresence(to: string): Promise<void> {
    try {
      await this.http.post("/instance/chatState", null, {
        params: {
          token: this.token,
          chatId: to.includes("@") ? to : `${to}@c.us`,
          state: "composing",
        },
      });
    } catch {
      /* best-effort */
    }
  }

  parseWebhook(payload: unknown): InboundMessage | null {
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const { data } = parsed.data;
    if (data.fromMe) return { phone: "", body: "", type: "chat", fromMe: true };
    return {
      phone: extractPhone(data.from),
      name: data.pushname,
      body: (data.body ?? "").trim(),
      type: mapType(data.type),
      mediaUrl: data.media,
      caption: data.caption,
      fromMe: false,
      externalId: data.id,
    };
  }
}
