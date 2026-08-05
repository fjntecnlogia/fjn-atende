/**
 * Cliente Clicksign — assinatura digital de contratos.
 * https://developers.clicksign.com/reference
 *
 * Fluxo típico:
 *  1. POST /api/v1/documents   → upload do PDF, retorna document key
 *  2. POST /api/v1/signers     → cria signatário (nome + email/telefone)
 *  3. POST /api/v1/lists       → associa signatário ao documento
 *  4. POST /api/v1/notifications → dispara e-mail/SMS pro signatário
 *  5. Webhook chega quando assinado → GET signed PDF
 */
import axios, { AxiosInstance } from "axios";
import { config } from "../config";

let cached: AxiosInstance | null = null;

export function isClicksignEnabled(): boolean {
  return !!config.CLICKSIGN_API_TOKEN;
}

export function getClicksign(): AxiosInstance {
  if (cached) return cached;
  if (!isClicksignEnabled()) throw new Error("CLICKSIGN_API_TOKEN não configurada");
  cached = axios.create({
    baseURL: config.CLICKSIGN_BASE_URL,
    params: { access_token: config.CLICKSIGN_API_TOKEN },
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  return cached;
}

// =====================================================================
// Tipos
// =====================================================================
export interface ClicksignDocument {
  key: string;
  filename: string;
  uploaded_at: string;
  status: string;
  downloads?: {
    signed_file_url?: string;
    original_file_url?: string;
  };
}

export interface ClicksignSigner {
  key: string;
  email: string;
  name: string;
  phone_number?: string;
}

// =====================================================================
// Métodos principais
// =====================================================================

/**
 * Faz upload do PDF (base64) no Clicksign.
 * Retorna key do documento criado.
 */
export async function uploadDocument(
  filename: string,
  pdfBase64: string,
  deadline?: Date,
): Promise<ClicksignDocument> {
  const cs = getClicksign();
  const body: any = {
    document: {
      path: `/FJN Atende/${filename}`,
      content_base64: `data:application/pdf;base64,${pdfBase64}`,
      deadline_at: (deadline ?? new Date(Date.now() + 30 * 86400 * 1000)).toISOString(),
      auto_close: true,
      locale: "pt-BR",
      sequence_enabled: false,
    },
  };
  const r = await cs.post("/api/v1/documents", body);
  return r.data.document;
}

/**
 * Cria signatário (pessoa que vai assinar).
 * Pode receber por e-mail e/ou WhatsApp.
 */
export async function createSigner(data: {
  email: string;
  name: string;
  phoneNumber?: string;  // formato +5511987654321
  documentation?: string;  // CPF
  hasDocumentation?: boolean;
  birthday?: string;
}): Promise<ClicksignSigner> {
  const cs = getClicksign();
  const body: any = {
    signer: {
      email: data.email,
      phone_number: data.phoneNumber,
      auths: data.phoneNumber ? ["email", "whatsapp"] : ["email"],
      name: data.name,
      documentation: data.documentation,
      has_documentation: !!data.documentation,
      birthday: data.birthday,
      selfie_enabled: false,
      handwritten_enabled: false,
      official_document_enabled: false,
      liveness_enabled: false,
    },
  };
  const r = await cs.post("/api/v1/signers", body);
  return r.data.signer;
}

/**
 * Associa signatário ao documento (cria "lista").
 */
export async function addSignerToDocument(
  documentKey: string,
  signerKey: string,
  signAs: "party" = "party",  // party = parte contratante
): Promise<any> {
  const cs = getClicksign();
  const r = await cs.post("/api/v1/lists", {
    list: {
      document_key: documentKey,
      signer_key: signerKey,
      sign_as: signAs,
      message: "Por favor, revise e assine o documento em anexo.",
    },
  });
  return r.data.list;
}

/**
 * Dispara notificação por e-mail pra o signatário.
 */
export async function notifySigner(requestSignatureKey: string): Promise<void> {
  const cs = getClicksign();
  await cs.post("/api/v1/notifications", {
    request_signature_key: requestSignatureKey,
    message: "Documento pronto pra sua assinatura digital.",
  });
}

/**
 * Busca status atual do documento.
 */
export async function getDocument(documentKey: string): Promise<ClicksignDocument> {
  const cs = getClicksign();
  const r = await cs.get(`/api/v1/documents/${documentKey}`);
  return r.data.document;
}

/**
 * Fluxo completo: upload PDF → cria signer → linka → notifica.
 * Retorna document_key + signer_key + request_signature_key.
 */
export async function sendForSignature(args: {
  pdfBase64: string;
  filename: string;
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  clientDocument?: string;
  deadlineDays?: number;
}): Promise<{
  documentKey: string;
  signerKey: string;
  requestSignatureKey: string;
  signPageUrl?: string;
}> {
  const deadline = new Date(Date.now() + (args.deadlineDays ?? 30) * 86400 * 1000);

  // 1) Upload documento
  const doc = await uploadDocument(args.filename, args.pdfBase64, deadline);

  // 2) Cria signer
  const signer = await createSigner({
    email: args.clientEmail,
    name: args.clientName,
    phoneNumber: args.clientPhone,
    documentation: args.clientDocument,
  });

  // 3) Associa
  const list = await addSignerToDocument(doc.key, signer.key);

  // 4) Notifica
  try {
    await notifySigner(list.request_signature_key);
  } catch (err) {
    // Silencia — notificação é opcional
  }

  return {
    documentKey: doc.key,
    signerKey: signer.key,
    requestSignatureKey: list.request_signature_key,
    signPageUrl: list.sign_url,
  };
}
