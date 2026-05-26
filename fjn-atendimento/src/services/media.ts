import axios from "axios";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

let openai: OpenAI | null = null;
if (config.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

async function downloadBuffer(url: string): Promise<Buffer> {
  const r = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30_000,
    maxContentLength: 25 * 1024 * 1024, // 25MB
  });
  return Buffer.from(r.data);
}

export async function transcribeAudio(url: string): Promise<string | null> {
  if (!openai) return null;
  try {
    const buf = await downloadBuffer(url);
    const file = new File([new Uint8Array(buf)], "audio.ogg", { type: "audio/ogg" });
    const r = await openai.audio.transcriptions.create({
      file,
      model: config.OPENAI_WHISPER_MODEL,
      language: "pt",
    });
    return r.text?.trim() || null;
  } catch (err: any) {
    console.error("Whisper falhou:", err.message);
    return null;
  }
}

/**
 * Baixa imagem e converte para base64.
 */
async function imageToBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const r = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxContentLength: 5 * 1024 * 1024,
    });
    const buf = Buffer.from(r.data);
    const mediaType = r.headers["content-type"]?.toString() ?? "image/jpeg";
    return { data: buf.toString("base64"), mediaType };
  } catch (err: any) {
    console.error("Download imagem falhou:", err.message);
    return null;
  }
}

/**
 * Usa Claude vision para descrever a imagem em linguagem natural,
 * permitindo que o histórico de conversa mantenha-se texto-only.
 */
export async function describeImage(url: string, caption?: string): Promise<string | null> {
  const img = await imageToBase64(url);
  if (!img) return null;

  const userText = caption
    ? `O cliente enviou esta imagem com a legenda: "${caption}". Descreva detalhadamente o que aparece na imagem em português, em até 3 frases, focando no que pode ser relevante para um atendimento (produto, problema, comprovante, documento etc).`
    : `Descreva detalhadamente esta imagem que um cliente enviou via WhatsApp, em português, em até 3 frases. Foque no que pode ser relevante para atendimento (produto, problema, comprovante, documento etc).`;

  try {
    const r = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: img.mediaType as any,
                data: img.data,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });
    const block = r.content[0];
    return block.type === "text" ? block.text.trim() : null;
  } catch (err: any) {
    console.error("Descrição de imagem falhou:", err.message);
    return null;
  }
}
