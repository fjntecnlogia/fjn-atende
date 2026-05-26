"use client";

import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Activity, UsersRound, AlertTriangle, Package, Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { KpiCard } from "@/components/ui/KpiCard";
import type { DashboardOverview } from "@fjn-painel/shared";

const productLabels: Record<string, string> = {
  stylogestor: "STYLOGESTOR",
  gymflow: "GYMFLOW",
  "fjn-dev": "FJN Dev",
  indefinido: "Não identificado",
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await api.get("/dashboard/overview")).data,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-gray2 mt-1">Visão geral em tempo real — FJN Tecnologia</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Conversas (24h)"
          value={isLoading ? "—" : data!.conversas_hoje}
          icon={<MessageSquare size={16} />}
          accent="orange"
        />
        <KpiCard
          label="Ativas agora"
          value={isLoading ? "—" : data!.conversas_ativas}
          icon={<Activity size={16} />}
          accent="cyan"
        />
        <KpiCard
          label="Leads totais"
          value={isLoading ? "—" : data!.leads_total}
          hint={`+${data?.leads_novos_semana ?? 0} nos últimos 7 dias`}
          icon={<UsersRound size={16} />}
          accent="green"
        />
        <KpiCard
          label="Handoffs pendentes"
          value={isLoading ? "—" : data!.handoffs_pendentes}
          icon={<AlertTriangle size={16} />}
          accent="orange"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico de mensagens 24h */}
        <div className="card p-6 xl:col-span-2">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Activity size={14} className="text-orange" />
            Mensagens nas últimas 24h
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.mensagens_24h ?? []}>
                <CartesianGrid stroke="#1A2358" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="#8A93B2" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8A93B2" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0F1A52",
                    border: "1px solid #1A2358",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#F4F6FF" }}
                />
                <Bar dataKey="count" fill="#FFBA00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por produto */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Package size={14} className="text-orange" />
              Conversas por produto
            </h3>
            {data?.por_produto.length ? (
              data.por_produto.map((p) => {
                const max = Math.max(...data.por_produto.map((x) => x.total));
                const pct = Math.round((p.total / max) * 100);
                return (
                  <div key={p.product} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-light/80">
                        {productLabels[p.product] ?? p.product}
                      </span>
                      <span className="font-semibold">{p.total}</span>
                    </div>
                    <div className="h-1.5 bg-navy4 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray2">Sem dados ainda</p>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Base total</p>
                <p className="font-display text-2xl font-extrabold text-light mt-1">
                  {data?.contatos_total ?? "—"}
                </p>
                <p className="text-xs text-gray2 mt-1">contatos registrados</p>
              </div>
              <Users size={28} className="text-orange/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
