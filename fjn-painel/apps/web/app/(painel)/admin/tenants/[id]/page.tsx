"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  Building2, ArrowLeft, ExternalLink, DollarSign, Calendar,
  Sparkles, AlertTriangle, RefreshCw, CreditCard, CheckCircle2,
  XCircle, Activity, TrendingUp, Plus, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { useAuth } from "@/lib/auth";

function money(c: number) {
  return `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const eventLabels: Record<string, { label: string; color: string; icon: any }> = {
  "sub_active":          { label: "Subscription ativada", color: "text-green-400", icon: CheckCircle2 },
  "sub_past_due":        { label: "Cobrança em atraso",   color: "text-red-400",   icon: AlertTriangle },
  "sub_canceled":        { label: "Subscription cancelada", color: "text-gray2",  icon: XCircle },
  "sub_incomplete":      { label: "Subscription incompleta", color: "text-orange", icon: Activity },
  "canceled":            { label: "Cancelou subscription", color: "text-red-400", icon: XCircle },
  "reactivated":         { label: "Reativou subscription", color: "text-green-400", icon: RefreshCw },
  "plan_changed":        { label: "Mudou de plano",       color: "text-orange",   icon: TrendingUp },
  "payment_succeeded":   { label: "Pagamento bem-sucedido", color: "text-green-400", icon: CheckCircle2 },
  "payment_failed":      { label: "Pagamento falhou",     color: "text-red-400",   icon: XCircle },
  "admin_extended":      { label: "Período estendido (admin)", color: "text-orange", icon: Plus },
  "admin_forced_active": { label: "Forçado ativo (admin)", color: "text-orange",   icon: ShieldCheck },
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const setActiveTenant = useAuth((s) => s.setActiveTenant);

  const { data: tenant, isLoading } = useQuery<any>({
    queryKey: ["tenant", params.id],
    queryFn: async () => (await api.get(`/tenants/${params.id}`)).data,
  });

  const { data: billing } = useQuery<any>({
    queryKey: ["tenant-billing", params.id],
    queryFn: async () => (await api.get(`/billing/admin/tenant/${params.id}`)).data,
    retry: false,
  });

  const extendMut = useMutation({
    mutationFn: async (days: number) => {
      const reason = prompt(`Conceder ${days} dias grátis. Motivo (opcional):`);
      return (await api.post(`/billing/admin/tenant/${params.id}/extend`, { days, reason: reason ?? undefined })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-billing", params.id] });
      qc.invalidateQueries({ queryKey: ["tenant", params.id] });
      toast.success("Período estendido!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const forceActiveMut = useMutation({
    mutationFn: async () => {
      const reason = prompt("Forçar status active. Motivo:");
      if (!reason) throw new Error("cancelado");
      return (await api.post(`/billing/admin/tenant/${params.id}/force-active`, { reason })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-billing", params.id] });
      qc.invalidateQueries({ queryKey: ["tenant", params.id] });
      toast.success("Tenant ativado!");
    },
    onError: (e: any) => {
      if (e.message === "cancelado") return;
      toast.error(e?.response?.data?.error ?? "Erro");
    },
  });

  const portalMut = useMutation({
    mutationFn: async () => (await api.post(`/billing/admin/tenant/${params.id}/portal`)).data,
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  async function changePlan(plan: string) {
    await api.patch(`/tenants/${params.id}`, { plan });
    toast.success("Plano atualizado");
    qc.invalidateQueries({ queryKey: ["tenant", params.id] });
  }

  async function changeStatus(status: string) {
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

  const sub = billing?.subscription;
  const events = billing?.events ?? [];
  const credits = billing?.credits;
  const monthlyUsage = billing?.monthly_usage ?? [];
  const aiUsedPct = sub ? Math.round((sub.ai_messages_used / sub.included_ai_messages) * 100) : 0;

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <button onClick={() => router.back()} className="text-sm text-gray2 hover:text-light flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="text-orange" />
            <h1 className="font-display text-3xl font-extrabold">{tenant.name}</h1>
            <Badge variant={tenant.status === "active" ? "active" : "paused"}>{tenant.status}</Badge>
          </div>
          <p className="text-sm text-gray2">
            <code className="text-orange">{tenant.slug}</code> · {tenant.email ?? "(sem e-mail)"} · Criado em {fmtDate(tenant.created_at)}
          </p>
        </div>
        <button onClick={impersonate} className="btn-primary flex items-center gap-2">
          <ExternalLink size={14} /> Visualizar como
        </button>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard label="Usuários" value={tenant.stats?.users ?? 0} />
        <KpiCard label="Contatos" value={tenant.stats?.contacts ?? 0} />
        <KpiCard label="Conversas" value={tenant.stats?.conversations ?? 0} />
        <KpiCard label="Mensagens" value={tenant.stats?.messages ?? 0} />
        <KpiCard label="Leads" value={tenant.stats?.leads ?? 0} accent="green" />
        <KpiCard label="Instâncias WhatsApp" value={tenant.stats?.active_instances ?? 0} accent="cyan" />
      </div>

      {/* ============ SEÇÃO BILLING ============ */}
      <div className="border-t border-border pt-6">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2 mb-4">
          <DollarSign className="text-orange" />
          Billing
        </h2>

        {!sub ? (
          <div className="card p-8 text-center">
            <Sparkles size={32} className="text-gray2 mx-auto mb-3" />
            <p className="text-gray2">Sem subscription ativa</p>
            <p className="text-xs text-gray2/70 mt-1">Tenant está no plano antigo (pre-Stripe) ou nunca assinou</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Coluna 1: Plano atual */}
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-light text-sm uppercase tracking-widest text-gray2">Plano atual</h3>
              <div>
                <p className="font-display font-extrabold text-2xl text-orange">{sub.plan_name}</p>
                <p className="text-sm text-light/80">
                  {money(sub.price_cents)} / {sub.billing_cycle === "annual" ? "ano" : "mês"}
                </p>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-gray2">Status</p>
                <span className={`inline-block text-[10px] uppercase font-bold px-2 py-1 rounded-full mt-1 ${
                  sub.status === "active"   ? "bg-green-500/15 text-green-400" :
                  sub.status === "past_due" ? "bg-red-500/15 text-red-400" :
                  "bg-gray2/15 text-gray2"
                }`}>
                  {sub.status}
                </span>
                {sub.cancel_at_period_end && (
                  <p className="text-[10px] text-orange mt-1">Cancela em {fmtDate(sub.current_period_end)}</p>
                )}
              </div>

              <div className="pt-2 border-t border-border space-y-1 text-xs">
                <p className="text-gray2">Início ciclo: <span className="text-light/80">{fmtDate(sub.current_period_start)}</span></p>
                <p className="text-gray2">Renova em: <span className="text-light/80">{fmtDate(sub.current_period_end)}</span></p>
                <p className="text-gray2">Dias restantes: <span className="text-orange font-bold">{sub.days_until_renewal ?? 0}</span></p>
              </div>
            </div>

            {/* Coluna 2: Uso */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-light text-sm uppercase tracking-widest text-gray2">Uso ciclo atual</h3>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-light/80">Mensagens IA</span>
                  <span className={
                    aiUsedPct >= 100 ? "text-red-400 font-bold" :
                    aiUsedPct >= 80 ? "text-orange font-bold" :
                    "text-light/80"
                  }>
                    {sub.ai_messages_used.toLocaleString("pt-BR")} / {sub.included_ai_messages.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="h-2 bg-navy4 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      aiUsedPct >= 100 ? "bg-red-500" :
                      aiUsedPct >= 80 ? "bg-orange" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(aiUsedPct, 100)}%` }}
                  />
                </div>
                {aiUsedPct >= 100 && (
                  <p className="text-[10px] text-red-400 mt-1">Excedeu cota — debitando do crédito</p>
                )}
              </div>

              {credits && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-gray2 mb-1">Crédito pré-pago</p>
                  <p className="font-display font-bold text-xl text-orange">
                    {money(Number(credits.balance_cents))}
                  </p>
                  <p className="text-[10px] text-gray2 mt-1">
                    Já comprou {money(Number(credits.total_purchased_cents))} · Gastou {money(Number(credits.total_spent_cents))}
                  </p>
                </div>
              )}
            </div>

            {/* Coluna 3: Ações admin */}
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-light text-sm uppercase tracking-widest text-gray2">Ações admin</h3>

              <button onClick={() => extendMut.mutate(7)}
                      className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
                <Plus size={14} /> Conceder +7 dias
              </button>
              <button onClick={() => extendMut.mutate(30)}
                      className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
                <Plus size={14} /> Conceder +30 dias
              </button>

              {sub.status !== "active" && (
                <button onClick={() => forceActiveMut.mutate()}
                        className="w-full text-sm py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 flex items-center justify-center gap-2 transition-colors">
                  <ShieldCheck size={14} /> Forçar ativo
                </button>
              )}

              <button onClick={() => portalMut.mutate()}
                      className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
                <ExternalLink size={14} /> Stripe Portal
              </button>
            </div>
          </div>
        )}

        {/* Uso mensal (consumo de crédito) */}
        {monthlyUsage.length > 0 && (
          <div className="card p-5 mt-4">
            <h3 className="font-bold text-light text-sm uppercase tracking-widest text-gray2 mb-3">
              Consumo por mês (últimos 6)
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray2">
                  <th className="pb-2">Mês</th>
                  <th className="pb-2">Créditos comprados</th>
                  <th className="pb-2">Créditos gastos</th>
                  <th className="pb-2">Excedente IA</th>
                </tr>
              </thead>
              <tbody>
                {monthlyUsage.map((m: any) => (
                  <tr key={m.month} className="border-t border-border/30">
                    <td className="py-2 font-mono text-xs">{m.month}</td>
                    <td className="py-2 text-green-400">+{money(Number(m.credits_added))}</td>
                    <td className="py-2 text-red-400">-{money(Number(m.credits_spent))}</td>
                    <td className="py-2 text-gray2">{m.ai_overage_count} msgs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Eventos */}
        {events.length > 0 && (
          <div className="card p-5 mt-4">
            <h3 className="font-bold text-light text-sm uppercase tracking-widest text-gray2 mb-3">
              Histórico de eventos
            </h3>
            <ul className="space-y-1">
              {events.slice(0, 20).map((e: any) => {
                const cfg = eventLabels[e.event_type] ?? { label: e.event_type, color: "text-gray2", icon: Activity };
                const Icon = cfg.icon;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2 px-2 hover:bg-white/3 rounded">
                    <Icon size={14} className={cfg.color + " flex-shrink-0"} />
                    <div className="flex-1 text-sm">
                      <span className={cfg.color + " font-semibold"}>{cfg.label}</span>
                      {e.event_type === "plan_changed" && e.from_plan_name && e.to_plan_name && (
                        <span className="text-gray2 ml-2 text-xs">
                          {e.from_plan_name} → {e.to_plan_name}
                        </span>
                      )}
                      {e.amount_cents > 0 && (
                        <span className="text-orange ml-2 font-bold text-xs">
                          {money(e.amount_cents)}
                        </span>
                      )}
                      {e.metadata?.reason && (
                        <p className="text-[10px] text-gray2 italic mt-0.5">{e.metadata.reason}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray2/70 flex-shrink-0">{relativeTime(e.created_at)} atrás</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ============ SEÇÃO PLANO LEGADO + STATUS ============ */}
      <div className="border-t border-border pt-6">
        <h2 className="font-display text-xl font-bold mb-3">Configurações legadas (deprecated)</h2>
        <p className="text-xs text-gray2 mb-4">
          Esses controles existem desde antes do Stripe Subscriptions.
          Pra clientes pagantes, use a seção Billing acima.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="font-semibold text-light mb-4">Plano (legado)</h3>
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
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-light mb-4">Status</h3>
            <div className="flex flex-wrap gap-2">
              {["active", "pending_payment", "past_due", "suspended", "canceled"].map((s) => (
                <button key={s} onClick={() => changeStatus(s)}
                        className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                          tenant.status === s ? "bg-orange/15 border-orange text-orange" : "border-border text-gray2 hover:text-light"
                        }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
