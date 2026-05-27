import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { resolveTenantByHost, brandingStyles } from "@/lib/resolve-tenant";

export const metadata: Metadata = {
  title: "FJN Atende — Atendimento WhatsApp com IA + Disparo em massa",
  description:
    "Plataforma SaaS que automatiza atendimento de WhatsApp com IA humanizada (Claude), captura leads 24/7, faz handoff inteligente e dispara campanhas anti-ban.",
  keywords: [
    "atendimento WhatsApp", "WhatsApp com IA", "chatbot WhatsApp",
    "disparo em massa WhatsApp", "WhatsApp Business automatizado",
    "Claude WhatsApp", "FJN Tecnologia",
  ],
  authors: [{ name: "FJN Tecnologia" }],
  openGraph: {
    title: "FJN Atende — WhatsApp com IA que vende por você",
    description: "Responde clientes 24/7, qualifica leads, dispara campanhas.",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get("host");
  const tenant = await resolveTenantByHost(host);
  const styles = brandingStyles(tenant);
  const customTitle = tenant?.hide_fjn_branding
    ? (tenant.branding?.company_name_override ?? tenant.name)
    : null;

  return (
    <html lang="pt-BR" style={{ cssText: styles } as any}>
      <head>
        {/* Sobrescreve title quando white-label oculta marca FJN */}
        {customTitle && <title>{customTitle}</title>}
        {tenant?.branding?.logo_url && (
          <link rel="icon" href={tenant.branding.logo_url} type="image/png" />
        )}
      </head>
      <body className="font-sans antialiased">
        <Providers initialTenantBranding={tenant}>{children}</Providers>
      </body>
    </html>
  );
}
