"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Users, Calendar, Activity, CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

function money(c: number) {
  return `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortMoney(c: number) {
  if (c >= 100000) return `R$ ${Math.round(c / 100 / 1000)}k`;
  return money(c);
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const eventLabels: Record<string, { label: string; color: string; icon: any }> = {
  "sub_active":          { label: "Ativada",        color: "text-green-400", icon: CheckCircle2 },
  "sub_past_due":        { label: "Em atraso",      color: "text-red-400",   icon: AlertTriangle },
  "sub_canceled":        { label: "Cancelada",      color: "text-gray2",     icon: XCircle },
  "sub_incomplete":      { label: "Incompleta",     color: "text-orange",    icon: Activity },
  "canceled":            { label: "Cancelou",       color: "text-red-400",   icon: XCircle },
  "reactivated":         { label: "Reativou",       color: "text-green-400", icon: RefreshCw },
  "plan_changed":        { label: "Mudou plano",    color: "text-orange",    icon: TrendingUp },
  "payment_succeeded":   { label: "Pagamento OK",   color: "text-green-400", icon: CheckCircle2 },
  "payment_failed":      { label: "Pagamento falhou", color: "text-red-400", icon: XCircle },
};

export default function AdminBillingPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: overview } = useQuery<any>({
    queryKey: ["billing-overview"],
    queryFn: async () => (await api.get("/billing/admin/overview")).data,
    refetchInterval: 60_000,
  });

  const { data: subs } = useQuery<any>({
    queryKey: ["billing-subs", { statusFilter, tierFilter, search }],
    queryFn: async () =>
      (await api.get("/billing/admin/subscriptions", {
        params: { status: statusFilter || undefined, tier: tierFilter || undefined, search: search || undefined },
      })).data,
  });

  const { data: events } = useQuery<any>({
    queryKey: ["billing-events"],
    queryFn: async () => (await api.get("/billing/admin/events?limit=30")).data,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <DollarSign className="text-orange" />
          Billing
        </h1>
        <p className="text-sm text-gray2 mt-1">
          Receita recorrente, assinantes e eventos do Stripe
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="MRR"
          value={overview ? shortMoney(overview.mrr_cents) : "—"}
          icon={<DollarSign size={16} />}
          hint="Receita mensal recorrente"
          highlight
        />
        <Kpi
          label="ARR"
          value={overview ? shortMoney(overview.arr_cents) : "—"}
          icon={<TrendingUp size={16} />}
          hint="MRR × 12"
        />
        <Kpi
          label="Receita 30d"
          value={overview ? shortMoney(overview.revenue_30d_cents) : "—"}
          icon={<Calendar size={16} />}
          hint={`${overview?.payments_30d_count ?? 0} pagamentos`}
        />
        <Kpi
          label="Assinantes ativos"
          value={overview?.active_count ?? "—"}
          icon={<Users size={16} />}
          hint={`${overview?.past_due_count ?? 0} em atraso`}
        />
      </div>

      {/* Alertas */}
      {overview && (overview.past_due_count > 0 || overview.failed_30d_count > 0) && (
        <div className="card p-4 bg-red-500/10 border-red-500/30">
          <p className="text-sm text-light/90 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <strong>{overview.past_due_count} tenant(s) em atraso</strong>
            {overview.failed_30d_count > 0 &&
              ` · ${overview.failed_30d_count} pagamentos falharam nos últimos 30 dias`}
          </p>
        </div>
      )}

      {/* Grid de subs + events */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
        {/* Lista de assinantes */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display font-bold text-light">Assinantes</h2>
            <div className="flex gap-2 text-xs">
              <input className="input text-xs" placeholder="Buscar..."
                     value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Status: todos</option>
                <option value="active">Ativos</option>
                <option value="past_due">Em atraso</option>
                <option value="canceled">Cancelados</option>
                <option value="incomplete">Incompletas</option>
              </select>
              <select className="input text-xs" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                <option value="">Tier: todos</option>
                <option value="pro">Pro</option>
                <option value="pro_plus">Pro+</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-gray2">
                  <th className="p-3 font-bold">Tenant</th>
                  <th className="p-3 font-bold">Plano</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Renova em</th>
                  <th className="p-3 font-bold">Cota IA</th>
                </tr>
              </thead>
              <tbody>
                {(subs?.items ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray2 italic">Nenhum assinante</td></tr>
                ) : (
                  subs.items.map((s: any) => (
                    <tr key={s.tenant_id} className="border-b border-border/50 hover:bg-white/3">
                      <td className="p-3">
                        <Link href={`/admin/tenants/${s.tenant_id}`} className="hover:text-orange">
                          <p className="font-bold text-light">{s.name}</p>
                          <p className="text-[10px] text-gray2">{s.email}</p>
                        </Link>
                      </td>
                      <td className="p-3">
                        <p className="text-light">{s.plan_name}</p>
                        <p className="text-[10px] text-gray2">
                          {money(s.price_cents)}/{s.billing_cycle === "annual" ? "ano" : "mês"}
                        </p>
                      </td>
                      <td className="p-3">
                        <SubBadge status={s.status} cancel={s.cancel_at_period_end} />
                      </td>
                      <td className="p-3 text-xs text-light/80">
                        {fmtDate(s.current_period_end)}
                      </td>
                      <td className="p-3 text-xs">
                        <span className={
                          s.ai_messages_used >= s.included_ai_messages ? "text-red-400" :
                          s.ai_messages_used >= s.included_ai_messages * 0.8 ? "text-orange" :
                          "text-light/80"
                        }>
                          {s.ai_messages_used.toLocaleString("pt-BR")}/{s.included_ai_messages.toLocaleString("pt-BR")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Eventos recentes */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-display font-bold text-light">Eventos recentes</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {(events?.items ?? []).length === 0 ? (
              <p className="p-8 text-center text-gray2 italic text-sm">Nenhum evento ainda</p>
            ) : (
              <ul>
                {events.items.map((e: any) => {
                  const cfg = eventLabels[e.event_type] ?? { label: e.event_type, color: "text-gray2", icon: Activity };
                  const Icon = cfg.icon;
                  return (
                    <li key={e.id} className="p-3 border-b border-border/30 hover:bg-white/3">
                      <div className="flex items-start gap-2">
                        <Icon size={14} className={cfg.color + " mt-0.5 flex-shrink-0"} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-light">
                            <span className={cfg.color + " font-bold"}>{cfg.label}</span>
                            {" — "}
                            <span className="text-light/80">{e.tenant_name}</span>
                          </p>
                          {e.event_type === "plan_changed" && e.from_plan_name && e.to_plan_name && (
                            <p className="text-[10px] text-gray2 mt-0.5">
                              {e.from_plan_name} → {e.to_plan_name}
                            </p>
                          )}
                          {e.amount_cents > 0 && (
                            <p className="text-[10px] text-orange mt-0.5 font-bold">
                              {money(e.amount_cents)}
                            </p>
                          )}
                          <p className="text-[10px] text-gray2/70 mt-0.5">{relativeTime(e.created_at)} atrás</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, hint, highlight }: any) {
  return (
    <div className={`card p-4 ${highlight ? "border-orange/40 bg-orange/5" : ""}`}>
      <div className="flex items-center gap-2 text-gray2 text-xs uppercase tracking-widest font-bold">
        <span className={highlight ? "text-orange" : "text-gray2"}>{icon}</span>
        {label}
      </div>
      <p className="font-display font-extrabold text-2xl text-light mt-2">{value}</p>
      {hint && <p className="text-[10px] text-gray2 mt-1">{hint}</p>}
    </div>
  );
}

function SubBadge({ status, cancel }: { status: string; cancel: boolean }) {
  if (cancel) return <span className="text-[10px] uppercase font-bold bg-orange/15 text-orange px-2 py-1 rounded-full">cancelando</span>;
  const map: Record<string, string> = {
    active:     "bg-green-500/15 text-green-400",
    past_due:   "bg-red-500/15 text-red-400",
    canceled:   "bg-gray2/15 text-gray2",
    incomplete: "bg-orange/15 text-orange",
    unpaid:     "bg-red-500/15 text-red-400",
  };
  return <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${map[status] ?? "bg-gray2/15 text-gray2"}`}>{status}</span>;
}
