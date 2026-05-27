import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FJN Atende — Atendimento WhatsApp com IA + Disparo em massa",
  description:
    "Plataforma SaaS que automatiza atendimento de WhatsApp com IA humanizada (Claude), captura leads 24/7, faz handoff inteligente e dispara campanhas anti-ban. 14 dias grátis.",
  keywords: [
    "atendimento WhatsApp", "WhatsApp com IA", "chatbot WhatsApp",
    "disparo em massa WhatsApp", "WhatsApp Business automatizado",
    "Claude WhatsApp", "FJN Tecnologia",
  ],
  authors: [{ name: "FJN Tecnologia" }],
  openGraph: {
    title: "FJN Atende — WhatsApp com IA que vende por você",
    description:
      "Responde clientes 24/7, qualifica leads, dispara campanhas. 14 dias grátis, sem cartão.",
    type: "website",
    locale: "pt_BR",
    siteName: "FJN Atende",
  },
  twitter: {
    card: "summary_large_image",
    title: "FJN Atende — WhatsApp com IA",
    description: "Atendimento automatizado 24/7 + disparo em massa.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
