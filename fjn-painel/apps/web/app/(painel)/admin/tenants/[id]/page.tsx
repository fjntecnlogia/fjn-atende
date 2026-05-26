"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Building2, ArrowLeft, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { useAuth } from "@/lib/auth";

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const setActiveTenant = useAuth((s) => s.setActiveTenant);

  const { data: tenant, isLoading } = useQuery<any>({
    queryKey: ["tenant", params.id],
    queryFn: async () => (await api.get(`/tenants/${params.id}`)).data,
  });

  async function changePlan(plan: string) {
    await api.patch(`/tenants/${params.id}`, { plan });
    toast.success("Plano atualizado");
    qc.invalidateQueries({ queryKey: ["tenant", params.id] });
  }

  async function changeStatus(status: "active" | "suspended" | "canceled") {
    await api.patch(`/tenants/${params.id}`, { status });
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["tenant", params.id] });
  }

  function impersonate() {
    if (!tenant) return;
    setActiveTenant(tenant);
    toast.success(`Visualizando como ${tenant.name}`);
    router.push("/dashboard");
  }

  if (isLoading) return <div className="p-8 text-gray2">Carregando...</div>;
  if (!tenant) return <div className="p-8 text-orange">Tenant não encontrado</div>;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <button onClick={() => router.back()} className="text-sm text-gray2 hover:text-light flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="text-orange" />
            <h1 className="font-display text-3xl font-extrabold">{tenant.name}</h1>
            <Badge variant={tenant.status === "active" ? "active" : "paused"}>{tenant.status}</Badge>
          </div>
          <p className="text-sm text-gray2">
            <code className="text-orange">{tenant.slug}</code> · {tenant.email ?? "(sem e-mail)"} · Criado em {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <button onClick={impersonate} className="btn-primary flex items-center gap-2">
          <ExternalLink size={14} /> Visualizar como
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard label="Usuários" value={tenant.stats?.users ?? 0} />
        <KpiCard label="Contatos" value={tenant.stats?.contacts ?? 0} />
        <KpiCard label="Conversas" value={tenant.stats?.conversations ?? 0} />
        <KpiCard label="Mensagens" value={tenant.stats?.messages ?? 0} />
        <KpiCard label="Leads" value={tenant.stats?.leads ?? 0} accent="green" />
        <KpiCard label="Instâncias WhatsApp ativas" value={tenant.stats?.active_instances ?? 0} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-semibold text-light mb-4">Plano</h3>
          <div className="flex flex-wrap gap-2">
            {["trial", "starter", "pro", "enterprise"].map((p) => (
              <button key={p} onClick={() => changePlan(p)}
                      className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                        tenant.plan === p ? "bg-orange text-navy2 border-orange" : "border-border text-gray2 hover:text-light"
                      }`}>
                {p}
              </button>
            ))}
          </div>
          {tenant.trial_ends_at && (
            <p className="text-xs text-gray2 mt-3">
              Trial termina em {new Date(tenant.trial_ends_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-light mb-4">Status</h3>
          <div className="flex gap-2">
            <button onClick={() => changeStatus("active")}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${tenant.status === "active" ? "bg-green-500/15 border-green-500 text-green-400" : "border-border text-gray2 hover:text-light"}`}>
              Ativo
            </button>
            <button onClick={() => changeStatus("suspended")}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${tenant.status === "suspended" ? "bg-orange/15 border-orange text-orange" : "border-border text-gray2 hover:text-light"}`}>
              Suspender
            </button>
            <button onClick={() => changeStatus("canceled")}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${tenant.status === "canceled" ? "bg-red-500/15 border-red-500 text-red-400" : "border-border text-gray2 hover:text-light"}`}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
