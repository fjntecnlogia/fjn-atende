/**
 * WhatsApp Cloud API (Meta oficial) — Business Platform.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Vantagens vs Evolution/WPP-Connect:
 *  ✅ Sem risco de ban (é a API oficial)
 *  ✅ Volume ilimitado (Enterprise grade)
 *  ✅ Selo "verified business" (opcional)
 *  ✅ Rate limits generosos
 *  ✅ SLA da Meta
 *
 * Custo por conversa iniciada pela empresa (Brasil 2026):
 *  - Marketing:     ~US$ 0,08 (R$ 0,45)
 *  - Utility:       ~US$ 0,03 (R$ 0,17)
 *  - Authentication: ~US$ 0,02 (R$ 0,11)
 *  - Iniciada pelo cliente: 1000/mês GRÁTIS
 *
 * Cadastro: guia detalhado em docs/guia-meta-whatsapp-business.md
 *
 * Multi-tenant: cada tenant pode ter suas próprias credenciais Meta
 * (armazenadas em whatsapp_instances.metadata). Fallback pra credenciais
 * globais do .env (config.META_WA_*) se tenant não configurou.
 */
import axios, { AxiosInstance } from "axios";
import { db } from "../db/client";
import { config } from "../config";

// =====================================================================
// Config resolver (tenant → env)
// =====================================================================

export interface MetaCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  apiVersion: string;
}

/**
 * Busca credenciais Meta pro tenant. Se tenant não configurou,
 * cai no .env global (útil pra sandbox / testes).
 */
export async function getMetaCredentials(tenantId: number): Promise<MetaCredentials> {
  const r = await db.query(
    `SELECT metadata FROM whatsapp_instances
      WHERE tenant_id = $1 AND provider = 'meta_cloud' AND status = 'connected'
      ORDER BY id ASC LIMIT 1`,
    [tenantId],
  ).catch(() => ({ rows: [] as any[] }));

  const inst = r.rows[0];
  const tenantMeta = inst?.metadata ?? {};

  const accessToken = tenantMeta.access_token || config.META_WA_ACCESS_TOKEN;
  const phoneNumberId = tenantMeta.phone_number_id || config.META_WA_PHONE_NUMBER_ID;
  const businessAccountId = tenantMeta.business_account_id || config.META_WA_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Meta Cloud API não configurada. Cadastre META_WA_ACCESS_TOKEN e META_WA_PHONE_NUMBER_ID " +
      "no .env (global) ou vincule instância WhatsApp com metadata específica do tenant.",
    );
  }

  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
    apiVersion: config.META_WA_API_VERSION,
  };
}

function meta(creds: MetaCredentials): AxiosInstance {
  return axios.create({
    baseURL: `https://graph.facebook.com/${creds.apiVersion}`,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });
}

// =====================================================================
// ENVIO DE MENSAGENS
// =====================================================================

/**
 * Manda mensagem de texto simples (conversa aberta pelo cliente).
 * Se conversa não está aberta, precisa usar template (sendMetaTemplate).
 */
export async function sendMetaMessage(args: {
  tenantId: number;
  to: string;      // +55XXXXXXXXXXX (com código do país)
  text: string;
}): Promise<any> {
  const creds = await getMetaCredentials(args.tenantId);
  const client = meta(creds);
  const to = args.to.replace(/\D/g, "");  // só dígitos

  const r = await client.post(`/${creds.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: args.text, preview_url: true },
  });
  return r.data;
}

/**
 * Manda TEMPLATE aprovado pela Meta (marketing/utility/auth).
 * Único jeito de iniciar conversa se cliente não respondeu ainda.
 */
export async function sendMetaTemplate(args: {
  tenantId: number;
  to: string;
  templateName: string;
  languageCode?: string;      // ex: "pt_BR"
  bodyParams?: string[];      // {{1}}, {{2}} ...
  headerParams?: string[];    // pra template com header dinâmico
}): Promise<any> {
  const creds = await getMetaCredentials(args.tenantId);
  const client = meta(creds);
  const to = args.to.replace(/\D/g, "");

  const components: any[] = [];
  if (args.headerParams && args.headerParams.length > 0) {
    components.push({
      type: "header",
      parameters: args.headerParams.map((p) => ({ type: "text", text: p })),
    });
  }
  if (args.bodyParams && args.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: args.bodyParams.map((p) => ({ type: "text", text: p })),
    });
  }

  const r = await client.post(`/${creds.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.languageCode ?? "pt_BR" },
      ...(components.length > 0 ? { components } : {}),
    },
  });
  return r.data;
}

/**
 * Manda documento (PDF, DOCX, etc).
 * Meta aceita base64 embutido ou URL pública.
 * Pra base64 grande (>16MB), usar upload de media primeiro.
 */
export async function sendMetaDocument(args: {
  tenantId: number;
  to: string;
  pdfBase64?: string;
  documentUrl?: string;
  filename: string;
  caption?: string;
  mimeType?: string;
}): Promise<any> {
  const creds = await getMetaCredentials(args.tenantId);
  const client = meta(creds);
  const to = args.to.replace(/\D/g, "");

  let documentPayload: any;
  if (args.documentUrl) {
    documentPayload = { link: args.documentUrl };
  } else if (args.pdfBase64) {
    // Meta Cloud API não aceita base64 direto no endpoint /messages —
    // precisa upload prévio no /media, receber media_id, e usar id.
    const mediaId = await uploadMetaMedia({
      tenantId: args.tenantId,
      base64: args.pdfBase64,
      mimeType: args.mimeType ?? "application/pdf",
      filename: args.filename,
    });
    documentPayload = { id: mediaId };
  } else {
    throw new Error("Precisa pdfBase64 OU documentUrl");
  }

  const r = await client.post(`/${creds.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: {
      ...documentPayload,
      filename: args.filename,
      caption: args.caption,
    },
  });
  return r.data;
}

/**
 * Upload de mídia pra Meta (retorna media_id que expira em 30 dias).
 * Necessário porque /messages não aceita base64 direto pra document.
 */
export async function uploadMetaMedia(args: {
  tenantId: number;
  base64: string;
  mimeType: string;
  filename: string;
}): Promise<string> {
  const creds = await getMetaCredentials(args.tenantId);

  // Meta espera multipart/form-data. Usa FormData nativo do node 20+.
  const buffer = Buffer.from(args.base64, "base64");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", args.mimeType);
  // @ts-ignore — Blob global no node 20+
  form.append("file", new Blob([buffer], { type: args.mimeType }), args.filename);

  const r = await axios.post(
    `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/media`,
    form,
    {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      timeout: 60_000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );
  return r.data.id;
}

// =====================================================================
// WEBHOOK — Meta chama nosso endpoint quando cliente responde
// =====================================================================

/**
 * Valida assinatura do webhook (X-Hub-Signature-256).
 * Meta assina com HMAC-SHA256 usando App Secret.
 */
export function verifyMetaWebhookSignature(payload: string, signature: string): boolean {
  if (!config.META_WA_APP_SECRET) return true;  // sem secret = pula validação (dev)
  if (!signature) return false;
  const crypto = require("crypto");
  const expected = "sha256=" + crypto
    .createHmac("sha256", config.META_WA_APP_SECRET)
    .update(payload)
    .digest("hex");
  return signature === expected;
}
