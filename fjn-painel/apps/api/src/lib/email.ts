/**
 * Cliente Resend + templates HTML.
 *
 * Templates inline (sem React Email pra evitar dep extra).
 * Branding FJN: navy + orange. Mobile-friendly.
 */
import { Resend } from "resend";
import { config } from "../config";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (!config.RESEND_API_KEY) return null;
  if (cached) return cached;
  cached = new Resend(config.RESEND_API_KEY);
  return cached;
}

export function isEmailEnabled(): boolean {
  return !!config.RESEND_API_KEY;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendArgs): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email skip] ${subject} → ${to} (RESEND_API_KEY não configurada)`);
    return;
  }
  try {
    await resend.emails.send({
      from: config.RESEND_FROM,
      replyTo: config.RESEND_REPLY_TO,
      to,
      subject,
      html,
    });
    console.log(`[email] ${subject} → ${to}`);
  } catch (err: any) {
    console.error(`[email error] ${err.message} | to=${to} subject=${subject}`);
  }
}

// =====================================================================
// Helper de layout (header + footer iguais em todos)
// =====================================================================

function wrap(body: string, opts: { preview?: string } = {}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>FJN Atende</title>
  ${opts.preview ? `<meta name="description" content="${opts.preview}" />` : ""}
</head>
<body style="margin:0;padding:0;background:#060C28;color:#F4F6FF;font-family:'Barlow','Helvetica Neue',Arial,sans-serif;">
  ${opts.preview ? `<div style="display:none;max-height:0;overflow:hidden;">${opts.preview}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060C28;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0F1A52;border:1px solid #1A2358;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:24px 32px;border-bottom:1px solid #1A2358;">
          <div style="font-family:'Barlow Condensed','Barlow',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:-0.5px;">
            <span style="color:#FFBA00;">FJN</span>
            <span style="color:#F4F6FF;"> Atende</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;border-top:1px solid #1A2358;text-align:center;font-size:12px;color:#8A93B2;">
          <p style="margin:0 0 8px;">© ${new Date().getFullYear()} FJN Tecnologia · Cuiabá-MT</p>
          <p style="margin:0;">
            <a href="https://atende.fjntecnologia.com.br/termos" style="color:#8A93B2;text-decoration:underline;margin:0 8px;">Termos</a>
            ·
            <a href="https://atende.fjntecnologia.com.br/privacidade" style="color:#8A93B2;text-decoration:underline;margin:0 8px;">Privacidade</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btnPrimary(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#FFBA00;color:#060C28;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;">${label}</a>`;
}

// =====================================================================
// TEMPLATES
// =====================================================================

export interface WelcomeEmailArgs {
  to: string;
  userName: string;
  tenantName: string;
}

export async function sendWelcomeEmail({ to, userName, tenantName }: WelcomeEmailArgs) {
  const body = `
    <h1 style="font-family:'Barlow Condensed',Arial,sans-serif;font-weight:800;font-size:28px;color:#FFBA00;margin:0 0 16px;">
      Bem-vindo(a), ${escapeHtml(userName.split(" ")[0])}! 🚀
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#F4F6FF;margin:0 0 16px;">
      Sua conta da <strong>${escapeHtml(tenantName)}</strong> foi criada com sucesso no FJN Atende.
      Você tem <strong style="color:#FFBA00;">14 dias grátis</strong> pra explorar tudo.
    </p>
    <h3 style="font-family:'Barlow Condensed',Arial,sans-serif;font-weight:700;font-size:18px;color:#F4F6FF;margin:24px 0 12px;">
      Próximos passos:
    </h3>
    <ol style="font-size:14px;line-height:1.7;color:rgba(244,246,255,0.85);padding-left:20px;margin:0 0 24px;">
      <li><strong>Conecte seu WhatsApp</strong> — vá em "WhatsApp" no menu, crie instância, escaneie o QR.</li>
      <li><strong>Customize a IA</strong> — em "Config IA", define persona, produtos, regras.</li>
      <li><strong>Teste</strong> — manda mensagem pro número conectado de outro celular.</li>
    </ol>
    <p style="text-align:center;margin:32px 0 16px;">
      ${btnPrimary("https://atende.fjntecnologia.com.br/dashboard", "Acessar painel")}
    </p>
    <p style="font-size:13px;color:#8A93B2;margin:24px 0 0;border-top:1px solid #1A2358;padding-top:16px;">
      Precisa de ajuda? Responda este e-mail ou chame no WhatsApp:
      <a href="https://wa.me/5565980900089" style="color:#FFBA00;text-decoration:none;">(65) 98090-0089</a>
    </p>
  `;
  await sendEmail({
    to,
    subject: "Bem-vindo(a) ao FJN Atende — sua conta está pronta",
    html: wrap(body, { preview: `Olá ${userName.split(" ")[0]}! Sua conta FJN Atende está pronta. 14 dias grátis.` }),
  });
}

export interface ReceiptEmailArgs {
  to: string;
  userName: string;
  amountCents: number;
  bonusCents: number;
  newBalanceCents: number;
  paymentId: string;
}

export async function sendReceiptEmail({
  to, userName, amountCents, bonusCents, newBalanceCents, paymentId,
}: ReceiptEmailArgs) {
  const money = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  const totalCredit = amountCents + bonusCents;
  const body = `
    <h1 style="font-family:'Barlow Condensed',Arial,sans-serif;font-weight:800;font-size:28px;color:#FFBA00;margin:0 0 8px;">
      Pagamento recebido ✅
    </h1>
    <p style="font-size:14px;color:#8A93B2;margin:0 0 24px;">Recibo de compra de créditos</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060C28;border:1px solid #1A2358;border-radius:8px;padding:16px;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#8A93B2;">Cliente</td>
          <td style="padding:6px 0;text-align:right;color:#F4F6FF;">${escapeHtml(userName)}</td></tr>
      <tr><td style="padding:6px 0;color:#8A93B2;">Valor pago</td>
          <td style="padding:6px 0;text-align:right;color:#F4F6FF;font-weight:600;">${money(amountCents)}</td></tr>
      ${bonusCents > 0 ? `
      <tr><td style="padding:6px 0;color:#8A93B2;">Bônus FJN</td>
          <td style="padding:6px 0;text-align:right;color:#3ddc84;font-weight:600;">+${money(bonusCents)}</td></tr>
      ` : ""}
      <tr><td colspan="2" style="border-top:1px solid #1A2358;padding-top:12px;"></td></tr>
      <tr><td style="padding:6px 0;color:#F4F6FF;font-weight:700;">Total creditado</td>
          <td style="padding:6px 0;text-align:right;color:#FFBA00;font-weight:800;font-size:20px;font-family:'Barlow Condensed',Arial,sans-serif;">${money(totalCredit)}</td></tr>
      <tr><td style="padding:6px 0;color:#8A93B2;">Novo saldo</td>
          <td style="padding:6px 0;text-align:right;color:#F4F6FF;">${money(newBalanceCents)}</td></tr>
    </table>

    <p style="font-size:13px;color:#8A93B2;margin:0 0 24px;">
      ID da transação: <code style="background:#060C28;padding:2px 6px;border-radius:4px;color:#FFBA00;font-size:12px;">${paymentId}</code>
    </p>

    <p style="text-align:center;margin:24px 0;">
      ${btnPrimary("https://atende.fjntecnologia.com.br/creditos", "Ver saldo no painel")}
    </p>
  `;
  await sendEmail({
    to,
    subject: `Recibo FJN Atende — ${money(totalCredit)} creditados`,
    html: wrap(body, { preview: `Pagamento de ${money(amountCents)} confirmado.` }),
  });
}

export interface LowBalanceEmailArgs {
  to: string;
  userName: string;
  balanceCents: number;
  thresholdCents: number;
}

export async function sendLowBalanceEmail({
  to, userName, balanceCents, thresholdCents,
}: LowBalanceEmailArgs) {
  const money = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  const body = `
    <h1 style="font-family:'Barlow Condensed',Arial,sans-serif;font-weight:800;font-size:24px;color:#FFBA00;margin:0 0 16px;">
      ⚠️ Seu saldo está baixo
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#F4F6FF;margin:0 0 16px;">
      Olá ${escapeHtml(userName.split(" ")[0])}, seu saldo de créditos no FJN Atende caiu
      pra <strong style="color:#FFBA00;">${money(balanceCents)}</strong> — abaixo do limite
      mínimo de ${money(thresholdCents)}.
    </p>
    <p style="font-size:14px;color:rgba(244,246,255,0.85);margin:0 0 24px;">
      Pra não interromper suas campanhas em andamento, recarregue o quanto antes:
    </p>
    <p style="text-align:center;margin:24px 0;">
      ${btnPrimary("https://atende.fjntecnologia.com.br/creditos/comprar", "Recarregar créditos")}
    </p>
    <p style="font-size:13px;color:#8A93B2;margin:24px 0 0;border-top:1px solid #1A2358;padding-top:16px;">
      💡 Configure recarga automática pra evitar esse problema: vá em Créditos → Configurações.
    </p>
  `;
  await sendEmail({
    to,
    subject: `⚠️ Saldo baixo — ${money(balanceCents)} restantes`,
    html: wrap(body, { preview: `Saldo abaixo do limite. Recarregue pra não pausar campanhas.` }),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
