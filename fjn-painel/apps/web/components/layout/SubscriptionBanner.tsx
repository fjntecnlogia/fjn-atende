"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Banner global de subscription.
 * Aparece no topo do painel quando:
 *  - tenant.status === 'pending_payment' → vermelho, CTA "Escolher plano"
 *  - tenant.status === 'past_due'        → vermelho, CTA "Atualizar pagamento"
 *  - sub.cancel_at_period_end === true   → amarelo, CTA "Reativar"
 *
 * Some em /planos, /configuracoes/plano e /login (pra não duplicar info).
 * Super-admin nunca vê.
 */
export function SubscriptionBanner() {
  const pathname = usePathname();
  const { user, tenant } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: sub } = useQuery<any>({
    queryKey: ["subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data,
    retry: false,
    enabled: !!user && !isSuperAdmin,
    refetchInterval: 60_000,
  });

  // Não mostra em algumas rotas
  if (pathname?.startsWith("/planos")) return null;
  if (pathname?.startsWith("/configuracoes/plano")) return null;
  if (pathname?.startsWith("/login")) return null;
  if (isSuperAdmin) return null;

  // Tenant.status é a fonte da verdade
  const tenantStatus = tenant?.status;

  if (tenantStatus === "pending_payment") {
    return (
      <Banner level="error" icon={<Sparkles size={16} />}>
        <strong>Sua conta ainda não tem plano ativo.</strong>{" "}
        Escolha um plano pra começar a usar o FJN Atende.
        <Link href="/planos" className="ml-3 underline font-bold hover:text-white">
          Escolher plano →
        </Link>
      </Banner>
    );
  }

  if (tenantStatus === "past_due") {
    return (
      <Banner level="error" icon={<AlertTriangle size={16} />}>
        <strong>Cobrança em atraso.</strong>{" "}
        Sua última cobrança falhou. Atualize seu pagamento pra desbloquear o acesso.
        <Link href="/configuracoes/plano" className="ml-3 underline font-bold hover:text-white">
          Resolver agora →
        </Link>
      </Banner>
    );
  }

  if (tenantStatus === "suspended") {
    return (
      <Banner level="error" icon={<AlertTriangle size={16} />}>
        <strong>Conta suspensa.</strong>{" "}
        Entre em contato com o suporte: <a href="https://wa.me/5565980900089" className="underline">WhatsApp (65) 98090-0089</a>
      </Banner>
    );
  }

  // Subscription será cancelada — banner amarelo de aviso
  if (sub?.cancel_at_period_end) {
    const days = sub.days_until_renewal ?? 0;
    return (
      <Banner level="warning" icon={<AlertTriangle size={16} />}>
        Sua assinatura será cancelada em <strong>{days} dias</strong>.
        <Link href="/configuracoes/plano" className="ml-3 underline font-bold hover:text-light">
          Reativar →
        </Link>
      </Banner>
    );
  }

  return null;
}

function Banner({
  level, icon, children,
}: {
  level: "error" | "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const bg = level === "error"
    ? "bg-red-500/15 border-b-red-500/30 text-red-200"
    : "bg-orange/15 border-b-orange/30 text-orange-100";

  return (
    <div className={`${bg} border-b py-2.5 px-4`}>
      <div className="flex items-center justify-center gap-2 text-sm">
        {icon}
        <span>{children}</span>
      </div>
    </div>
  );
}
