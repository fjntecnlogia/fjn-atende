"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, MessageSquare, Megaphone, Users, TrendingUp, ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

function money(c: number) {
  return `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function AdminUsagePage() {
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");

  const { data } = useQuery<any>({
    queryKey: ["admin-usage", period],
    queryFn: async () => (await api.get(`/billing/admin/usage?period=${period}`)).data,
    refetchInterval: 60_000,
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Activity className="text-orange" />
            Consumo & Uso
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Ranking de tenants por consumo de IA e alertas de abuse
          </p>
        </div>
        <div className="flex gap-1 bg-navy3 rounded-full p-1 border border-border">
          {(["today", "7d", "30d"] as const).map((p) => (
            <button key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition ${
                      period === p ? "bg-orange text-navy2" : "text-gray2 hover:text-light"
                    }`}>
              {p === "today" ? "Hoje" : p === "7d" ? "7d" : "30d"}
            </button>
          ))}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Total msgs IA"
          value={data ? Number(data.totals.total_ai_messages).toLocaleString("pt-BR") : "—"}
          icon={<MessageSquare size={16} />}
          highlight
        />
        <Kpi
          label="Total msgs campanha"
          value={data ? Number(data.totals.total_campaign_msgs).toLocaleString("pt-BR") : "—"}
          icon={<Megaphone size={16} />}
        />
        <Kpi
          label="Tenants ativos"
          value={data?.totals.active_tenants ?? "—"}
          icon={<Users size={16} />}
        />
        <Kpi
          label="Acima da cota"
          value={data?.totals.tenants_over_quota ?? "—"}
          icon={<AlertTriangle size={16} />}
          variant={Number(data?.totals.tenants_over_quota) > 0 ? "danger" : "default"}
        />
      </div>

      {/* Alertas de abuse */}
      {data?.abuse_alerts?.length > 0 && (
        <div className="card p-0 overflow-hidden border-red-500/30">
          <div className="p-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="font-display font-bold text-red-200">
              Tenants excedendo cota — {data.abuse_alerts.length}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-gray2">
                  <th className="p-3 font-bold">Tenant</th>
                  <th className="p-3 font-bold">Plano</th>
                  <th className="p-3 font-bold">Cota</th>
                  <th className="p-3 font-bold">Usado</th>
                  <th className="p-3 font-bold">Excedente</th>
                  <th className="p-3 font-bold">Custo excedente</th>
                  <th className="p-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.abuse_alerts.map((a: any) => (
                  <tr key={a.tenant_id} className="border-b border-border/50 hover:bg-white/3">
                    <td className="p-3">
                      <p className="font-bold text-light">{a.name}</p>
                      <p className="text-[10px] text-gray2">{a.email}</p>
                    </td>
                    <td className="p-3 text-light/80">{a.plan_name}</td>
                    <td className="p-3 text-gray2">{a.included_ai_messages.toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-red-400 font-bold">{a.ai_messages_used.toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-red-400">+{a.over_count.toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-orange font-bold">R$ {a.overage_cost_reais}</td>
                    <td className="p-3 text-right">
                      <Link href={`/admin/tenants/${a.tenant_id}`}
                            className="text-xs text-orange hover:underline flex items-center gap-1 justify-end">
                        Detalhes <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-display font-bold text-light flex items-center gap-2">
            <TrendingUp size={16} className="text-orange" />
            Top tenants por consumo IA
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-gray2">
                <th className="p-3 font-bold">#</th>
                <th className="p-3 font-bold">Tenant</th>
                <th className="p-3 font-bold">Plano</th>
                <th className="p-3 font-bold">Msgs IA</th>
                <th className="p-3 font-bold">% Cota</th>
                <th className="p-3 font-bold">Conversas ativas</th>
                <th className="p-3 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ranking ?? []).length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray2 italic">Nenhum dado ainda</td></tr>
              ) : (
                data.ranking.map((r: any, idx: number) => {
                  const pct = Number(r.pct_used);
                  const pctColor = pct >= 100 ? "text-red-400" : pct >= 80 ? "text-orange" : "text-light/80";
                  return (
                    <tr key={r.tenant_id} className="border-b border-border/50 hover:bg-white/3">
                      <td className="p-3 text-gray2 text-xs font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <p className="font-bold text-light">{r.name}</p>
                        <p className="text-[10px] text-gray2">{r.email}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-light/80">{r.plan_name}</p>
                        <p className="text-[10px] text-gray2 uppercase">{r.tier}</p>
                      </td>
                      <td className="p-3 text-light/90 font-bold">
                        {r.ai_messages_used.toLocaleString("pt-BR")}
                        <span className="text-gray2 text-[10px] ml-1">/ {r.included_ai_messages.toLocaleString("pt-BR")}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-navy4 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange" : "bg-green-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${pctColor}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-light/80">{r.active_conversations}</td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/tenants/${r.tenant_id}`}
                              className="text-xs text-orange hover:underline flex items-center gap-1 justify-end">
                          <ExternalLink size={11} /> Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dica */}
      <div className="card p-4 bg-navy4/30 border-border">
        <p className="text-xs text-light/80">
          💡 <strong>Como interpretar:</strong> tenants com cota acima de 80% (laranja) provavelmente precisam de upgrade.
          Tenants acima de 100% (vermelho) já estão pagando excedente do crédito.
          Acima de 200% pode indicar uso anormal ou abuse — investigue.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, highlight, variant }: any) {
  const isDanger = variant === "danger";
  return (
    <div className={`card p-4 ${
      isDanger ? "border-red-500/40 bg-red-500/5" :
      highlight ? "border-orange/40 bg-orange/5" : ""
    }`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-gray2">
        <span className={isDanger ? "text-red-400" : highlight ? "text-orange" : "text-gray2"}>{icon}</span>
        {label}
      </div>
      <p className={`font-display font-extrabold text-2xl mt-2 ${
        isDanger ? "text-red-400" : "text-light"
      }`}>{value}</p>
    </div>
  );
}
