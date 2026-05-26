import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import type { InboundMessage, WhatsAppProvider } from "./types";

export interface EvolutionConfig {
  baseUrl: string;       // ex: http://evolution-api:8080
  apiKey: string;
  instance: string;      // ex: "fjn-atendimento"
}

/**
 * Schema flexível do payload do Evolution API.
 * Evento esperado: "messages.upsert"
 * Doc: https://doc.evolution-api.com/v2/api-reference/webhook
 */
const payloadSchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }),
    pushName: z.string().optional(),
    messageType: z.string().optional(),
    message: z.record(z.any()).optional(),
    messageTimestamp: z.number().optional(),
  }),
});

function extractPhone(jid: string): string {
  // "5511999998888@s.whatsapp.net" → "5511999998888"
  return jid.split("@")[0];
}

interface ParsedMedia {
  type: InboundMessage["type"];
  body: string;
  mediaUrl?: string;
  caption?: string;
}

function parseMessage(messageType: string | undefined, message: Record<string, any> | undefined): ParsedMedia {
  if (!message) return { type: "unknown", body: "" };

  // Texto puro
  if (message.conversation) {
    return { type: "chat", body: String(message.conversation).trim() };
  }
  if (message.extendedTextMessage?.text) {
    return { type: "chat", body: String(message.extendedTextMessage.text).trim() };
  }

  // Imagem (com legenda opcional)
  if (message.imageMessage) {
    return {
      type: "image",
      body: "",
      mediaUrl: message.imageMessage.url ?? message.imageMessage.directPath,
      caption: message.imageMessage.caption,
    };
  }

  // Áudio (PTT ou normal)
  if (message.audioMessage) {
    return {
      type: "audio",
      body: "",
      mediaUrl: message.audioMessage.url ?? message.audioMessage.directPath,
    };
  }

  // Vídeo
  if (message.videoMessage) {
    return {
      type: "video",
      body: "",
      mediaUrl: message.videoMessage.url,
      caption: message.videoMessage.caption,
    };
  }

  // Documento
  if (message.documentMessage) {
    return {
      type: "document",
      body: "",
      mediaUrl: message.documentMessage.url,
      caption: message.documentMessage.fileName,
    };
  }

  // Sticker
  if (message.stickerMessage) {
    return { type: "sticker", body: "" };
  }

  // Localização
  if (message.locationMessage) {
    const lat = message.locationMessage.degreesLatitude;
    const lng = message.locationMessage.degreesLongitude;
    return { type: "location", body: `lat:${lat} lng:${lng}` };
  }

  // Contato
  if (message.contactMessage || message.contactsArrayMessage) {
    return { type: "contact", body: "" };
  }

  // Fallback usando messageType
  switch (messageType) {
    case "audioMessage": return { type: "audio", body: "" };
    case "imageMessage": return { type: "image", body: "" };
    case "videoMessage": return { type: "video", body: "" };
    default:             return { type: "unknown", body: "" };
  }
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly name = "evolution";
  private http: AxiosInstance;
  private instance: string;

  constructor(cfg: EvolutionConfig) {
    this.instance = cfg.instance;
    this.http = axios.create({
      baseURL: cfg.baseUrl.replace(/\/$/, ""),
      timeout: 15_000,
      headers: {
        apikey: cfg.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  private formatNumber(to: string): string {
    // Evolution aceita só dígitos com DDI (ex: "5511999998888")
    return to.replace(/\D/g, "");
  }

  async sendText(to: string, body: string): Promise<void> {
    await this.http.post(`/message/sendText/${this.instance}`, {
      number: this.formatNumber(to),
      text: body,
      delay: 0,
      linkPreview: false,
    });
  }

  async sendTypingPresence(to: string): Promise<void> {
    try {
      await this.http.post(`/chat/sendPresence/${this.instance}`, {
        number: this.formatNumber(to),
        presence: "composing",
        delay: 1500,
      });
    } catch {
      /* best-effort */
    }
  }

  parseWebhook(payload: unknown): InboundMessage | null {
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const { event, data } = parsed.data;

    // Aceita só o evento de mensagem nova
    if (event && event !== "messages.upsert") return null;

    // Pula grupos por enquanto (jid contém "@g.us")
    if (data.key.remoteJid.includes("@g.us")) return null;

    if (data.key.fromMe) {
      return { phone: "", body: "", type: "chat", fromMe: true };
    }

    const parsedMsg = parseMessage(data.messageType, data.message);

    return {
      phone: extractPhone(data.key.remoteJid),
      name: data.pushName,
      body: parsedMsg.body,
      type: parsedMsg.type,
      mediaUrl: parsedMsg.mediaUrl,
      caption: parsedMsg.caption,
      fromMe: false,
      externalId: data.key.id,
    };
  }
}
