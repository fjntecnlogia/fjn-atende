/**
 * Resolução de tenant por host (white-label).
 *
 * Estratégia:
 *   1. host = atende.fjntecnologia.com.br      → null (FJN padrão)
 *   2. host = xxx.atende.fjntecnologia.com.br  → busca tenant com subdomain='xxx'
 *   3. host = atende.cliente.com.br            → busca tenant cujo subdomain
 *                                                completo bate (futuro: CNAME apex)
 *   4. host = localhost / *.vercel.app         → null (FJN padrão)
 *
 * Roda server-side (no RootLayout) pra renderizar CSS variables no HTML
 * antes do JS hidratar. Fetch é cacheado por 60s pra não estourar API.
 */

const BASE_DOMAIN = "atende.fjntecnologia.com.br";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-painel.fjntecnologia.com.br";

export interface ResolvedTenantBranding {
  id?: number;
  slug?: string;
  name: string;
  branding: {
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    company_name_override?: string;
  };
  hide_fjn_branding: boolean;
  support_email: string | null;
  support_phone: string | null;
}

export async function resolveTenantByHost(host: string | null): Promise<ResolvedTenantBranding | null> {
  if (!host) return null;

  // Remove porta
  const cleanHost = host.split(":")[0].toLowerCase();

  // Hosts default → FJN padrão
  if (cleanHost === "localhost") return null;
  if (cleanHost.endsWith(".vercel.app")) return null;
  if (cleanHost === BASE_DOMAIN) return null;

  // Subdomain de atende.fjntecnologia.com.br
  let subdomain: string | null = null;
  if (cleanHost.endsWith("." + BASE_DOMAIN)) {
    subdomain = cleanHost.slice(0, -("." + BASE_DOMAIN).length);
  }

  // Custom domain (futuro: tenant cadastra dominio proprio)
  // Por ora, ignorado.
  if (!subdomain) return null;

  // Subdomain reservados (não são tenants)
  const reserved = ["www", "api", "api-painel", "wa", "evolution", "wppconnect"];
  if (reserved.includes(subdomain)) return null;

  try {
    const res = await fetch(`${API_URL}/branding/by-subdomain/${subdomain}`, {
      next: { revalidate: 60 },  // cache 60s no edge
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Constrói CSS variables string pra injetar em <html style="...">
 * Fallback nas cores FJN padrão se tenant não definiu.
 */
export function brandingStyles(t: ResolvedTenantBranding | null): string {
  const primary = t?.branding?.primary_color ?? "#0B1340";
  const accent = t?.branding?.accent_color ?? "#FFBA00";
  return `--tenant-primary:${primary};--tenant-accent:${accent};`;
}
