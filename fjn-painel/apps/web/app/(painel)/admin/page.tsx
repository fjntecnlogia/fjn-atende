"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, TrendingUp, AlertTriangle, UserPlus, MessageSquare, Crown } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard } from "@/components/ui/KpiCard";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SuperAdminOverview } from "@fjn-painel/shared";

export default function AdminOverviewPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (user && user.role !== "super_admin") router.replace("/dashboard");
  }, [user, router]);

  const { data, isLoading } = useQuery<SuperAdminOverview>({
    queryKey: ["super-admin-overview"],
    queryFn: async () => (await api.get("/tenants/overview")).data,
    refetchInterval: 30_000,
    enabled: user?.role === "super_admin",
  });

  if (!user || user.role !== "super_admin") return null;

  const mrr = data?.mrr_cents ? (data.mrr_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="text-orange" />
        <h1 className="font-display text-3xl font-extrabold">Super Admin</h1>
        <span className="text-xs font-bold uppercase tracking-widest text-orange bg-orange/10 border border-orange/30 px-3 py-1 rounded-full">
          FJN Atende — operação
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Tenants ativos" value={isLoading ? "—" : data!.tenants_active}
                 icon={<Building2 size={16} />} accent="cyan" />
        <KpiCard label="Em Trial" value={isLoading ? "—" : data!.tenants_trial}
                 icon={<UserPlus size={16} />} accent="orange"
                 hint={`+${data?.signups_last_30d ?? 0} signups em 30d`} />
        <KpiCard label="MRR Mensal" value={mrr}
                 icon={<TrendingUp size={16} />} accent="green"
                 hint={`Total: ${data?.tenants_total ?? 0} tenants`} />
        <KpiCard label="Mensagens (30d)" value={isLoading ? "—" : data!.messages_last_30d.toLocaleString("pt-BR")}
                 icon={<MessageSquare size={16} />} accent="purple" />
      </div>

      {(data?.tenants_suspended ?? 0) > 0 && (
        <div className="card p-4 border-orange/30 bg-orange/5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-light">{data?.tenants_suspended} tenant(s) suspensos</p>
            <p className="text-sm text-gray2">Verifique pagamentos / problemas pra reativar</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/tenants" className="card p-6 hover:border-orange/50 transition-colors group">
          <Building2 size={24} className="text-orange mb-3" />
          <h3 className="font-semibold text-light text-lg group-hover:text-orange transition-colors">Gerenciar Tenants</h3>
          <p className="text-xs text-gray2 mt-1">Lista, edita plano, suspende</p>
        </Link>

        <Link href="/admin/tenants?status=trial" className="card p-6 hover:border-orange/50 transition-colors group">
          <UserPlus size={24} className="text-orange mb-3" />
          <h3 className="font-semibold text-light text-lg group-hover:text-orange transition-colors">Trials ativos</h3>
          <p className="text-xs text-gray2 mt-1">Acompanha conversões</p>
        </Link>

        <div className="card p-6 opacity-50">
          <TrendingUp size={24} className="text-orange mb-3" />
          <h3 className="font-semibold text-light text-lg">Relatórios</h3>
          <p className="text-xs text-gray2 mt-1">Em breve</p>
        </div>
      </div>
    </div>
  );
}
