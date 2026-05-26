import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import type { InboundMessage, WhatsAppProvider } from "./types";

export interface WppConnectConfig {
  baseUrl: string;       // ex: http://wppconnect:21465
  secretKey: string;     // SECRET_KEY global do servidor
  session: string;       // ex: "fjn-atendimento"
  sessionToken?: string; // token JWT da sessão (gerado via /generate-token)
}

/**
 * Schema do payload de webhook do WPP-Connect (event = "onmessage").
 * Doc: https://wppconnect-team.github.io/api/
 */
const payloadSchema = z.object({
  event: z.string().optional(),
  session: z.string().optional(),
  id: z.union([z.string(), z.object({}).passthrough()]).optional(),
  body: z.string().optional().default(""),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  fromMe: z.boolean().optional(),
  notifyName: z.string().optional(),
  isGroupMsg: z.boolean().optional(),
  caption: z.string().optional(),
  mediaUrl: z.string().optional(),
  mimetype: z.string().optional(),
}).passthrough();

function extractPhone(jid: string | undefined): string {
  if (!jid) return "";
  // "5511999998888@c.us" → "5511999998888"
  return jid.split("@")[0];
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

export class WppConnectProvider implements WhatsAppProvider {
  readonly name = "wppconnect";
  private http: AxiosInstance;
  private session: string;
  private secretKey: string;
  private sessionToken?: string;

  constructor(cfg: WppConnectConfig) {
    this.session = cfg.session;
    this.secretKey = cfg.secretKey;
    this.sessionToken = cfg.sessionToken;
    this.http = axios.create({
      baseURL: cfg.baseUrl.replace(/\/$/, ""),
      timeout: 15_000,
    });
  }

  /**
   * Gera ou recupera o token da sessão.
   * Se já temos um sessionToken passado via env, usa direto.
   * Caso contrário, chama /generate-token uma vez e cacheia.
   */
  private async ensureToken(): Promise<string> {
    if (this.sessionToken) return this.sessionToken;
    const r = await this.http.post(
      `/api/${this.session}/${this.secretKey}/generate-token`,
    );
    // Resposta típica: { status: "Success", token: "xxx", full: "Bearer xxx" }
    const token = r.data?.token ?? r.data?.full?.replace(/^Bearer /, "");
    if (!token) throw new Error("WPP-Connect: falha ao gerar token");
    this.sessionToken = token;
    return token;
  }

  private async authHeaders() {
    const token = await this.ensureToken();
    return { Authorization: `Bearer ${token}` };
  }

  private formatNumber(to: string): string {
    return to.replace(/\D/g, "");
  }

  async sendText(to: string, body: string): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(
      `/api/${this.session}/send-message`,
      {
        phone: this.formatNumber(to),
        message: body,
        isGroup: false,
      },
      { headers },
    );
  }

  async sendTypingPresence(to: string): Promise<void> {
    try {
      const headers = await this.authHeaders();
      await this.http.post(
        `/api/${this.session}/typing`,
        {
          phone: this.formatNumber(to),
          value: true,
        },
        { headers },
      );
    } catch {
      /* best-effort */
    }
  }

  parseWebhook(payload: unknown): InboundMessage | null {
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    const p = parsed.data;

    // Só processa o evento de mensagem recebida
    if (p.event && p.event !== "onmessage") return null;

    // Pula grupos por enquanto
    if (p.isGroupMsg) return null;

    if (p.fromMe) {
      return { phone: "", body: "", type: "chat", fromMe: true };
    }

    return {
      phone: extractPhone(p.from),
      name: p.notifyName,
      body: (p.body ?? "").trim(),
      type: mapType(p.type),
      mediaUrl: p.mediaUrl,
      caption: p.caption,
      fromMe: false,
      externalId: typeof p.id === "string" ? p.id : undefined,
    };
  }
}
