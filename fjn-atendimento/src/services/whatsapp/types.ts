/**
 * Interface unificada de qualquer provedor WhatsApp.
 * Permite trocar entre UltraMsg, Evolution API, etc. sem mexer no resto.
 */

export interface InboundMessage {
  /** Telefone do remetente (só dígitos, com DDI). Ex: "5511999998888" */
  phone: string;
  /** Nome do contato (pushname do WhatsApp), se houver */
  name?: string;
  /** Conteúdo textual já normalizado. Vazio se for mídia pura sem caption. */
  body: string;
  /** Tipo da mensagem original */
  type: "chat" | "audio" | "image" | "video" | "document" | "location" | "contact" | "sticker" | "unknown";
  /** URL pública da mídia, se houver (áudio/imagem/etc) */
  mediaUrl?: string;
  /** Caption/legenda da mídia (geralmente em imagens) */
  caption?: string;
  /** A mensagem foi enviada pela própria instância (ignorar) */
  fromMe: boolean;
  /** ID único da mensagem no provedor (deduplicação opcional) */
  externalId?: string;
}

export interface WhatsAppProvider {
  /** Nome do provider (para logs) */
  readonly name: string;

  /** Envia texto simples */
  sendText(to: string, body: string): Promise<void>;

  /** Mostra "digitando..." no app do destinatário (best-effort, pode no-op) */
  sendTypingPresence(to: string): Promise<void>;

  /**
   * Faz parse de um webhook payload bruto do provedor para o formato unificado.
   * Retorna null se não for uma mensagem válida (ex: ack, status, etc).
   */
  parseWebhook(payload: unknown): InboundMessage | null;
}
