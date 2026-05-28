"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Users, UserPlus, UserMinus,
  PieChart as PieIcon, Target, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";

const COLORS = ["#FFBA00", "#3B82F6", "#22C55E", "#EF4444", "#8B5CF6", "#FB923C"];

function money(c: number) {
  return `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
function shortMoney(c: number) {
  if (c >= 100000) return `R$ ${Math.round(c / 100 / 1000)}k`;
  return money(c);
}

export default function AdminDashboardPage() {
  const { data } = useQuery<any>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await api.get("/billing/admin/dashboard")).data,
    refetchInterval: 60_000,
  });

  if (!data) return <div className="p-8 text-gray2">Carregando dashboard...</div>;

  // Prepara dados pros gráficos
  const mrrData = data.mrr_timeline.map((m: any) => ({
    month: m.month_label.split("-")[1] + "/" + m.month_label.split("-")[0].slice(2),
    MRR: Number(m.mrr_cents) / 100,
  }));

  const signupsVsSubsData = data.new_signups_timeline.map((s: any, i: number) => ({
    month: s.month_label.split("-")[1] + "/" + s.month_label.split("-")[0].slice(2),
    Signups: s.signups,
    Assinaturas: data.new_subs_timeline[i]?.new_subs ?? 0,
  }));

  const cancellationsData = data.cancellations_timeline.map((c: any) => ({
    month: c.month_label.split("-")[1] + "/" + c.month_label.split("-")[0].slice(2),
    Cancelamentos: c.cancellations,
  }));

  const planDistData = data.plan_distribution.map((p: any) => ({
    name: p.plan_name,
    value: p.count,
  }));

  const funnel = data.conversion_funnel;
  const conversionRate = funnel.total_signups > 0
    ? ((funnel.active_paying / funnel.total_signups) * 100).toFixed(1)
    : "0.0";

  // Tendência MRR (último vs anterior)
  const mrrCurrent = mrrData[mrrData.length - 1]?.MRR ?? 0;
  const mrrPrev = mrrData[mrrData.length - 2]?.MRR ?? 0;
  const mrrTrend = mrrPrev > 0 ? ((mrrCurrent - mrrPrev) / mrrPrev) * 100 : 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Sparkles className="text-orange" />
          Dashboard Executivo
        </h1>
        <p className="text-sm text-gray2 mt-1">
          Métricas-chave do negócio nos últimos 12 meses
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBig
          label="MRR atual"
          value={shortMoney(mrrCurrent * 100)}
          icon={<DollarSign size={18} />}
          trend={mrrTrend}
          highlight
        />
        <KpiBig
          label="ARR projetado"
          value={shortMoney(mrrCurrent * 12 * 100)}
          icon={<TrendingUp size={18} />}
          hint="MRR × 12"
        />
        <KpiBig
          label="Churn rate (30d)"
          value={`${data.churn_rate}%`}
          icon={<UserMinus size={18} />}
          hint={`${data.churn_30d_count} cancelamentos / ${data.active_30d_ago} ativos`}
          variant={data.churn_rate > 5 ? "danger" : data.churn_rate > 2 ? "warning" : "default"}
        />
        <KpiBig
          label="Conv. signup→pago"
          value={`${conversionRate}%`}
          icon={<Target size={18} />}
          hint={`${funnel.active_paying} / ${funnel.total_signups} signups (90d)`}
        />
      </div>

      {/* MRR Timeline */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
          <DollarSign className="text-orange" size={18} />
          MRR — últimos 12 meses
        </h2>
        <p className="text-xs text-gray2 mb-4">Receita mensal recorrente (R$)</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={mrrData}>
            <CartesianGrid stroke="#1A2358" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#8A93B2" style={{ fontSize: 11 }} />
            <YAxis stroke="#8A93B2" style={{ fontSize: 11 }}
                   tickFormatter={(v) => `R$ ${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
            <Tooltip
              contentStyle={{ background: "#0F1A52", border: "1px solid #1A2358", borderRadius: 8 }}
              labelStyle={{ color: "#F4F6FF" }}
              formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR")}`}
            />
            <Line type="monotone" dataKey="MRR" stroke="#FFBA00" strokeWidth={3}
                  dot={{ fill: "#FFBA00", r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Signups vs Subs — Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
            <UserPlus className="text-orange" size={18} />
            Signups vs Assinaturas
          </h2>
          <p className="text-xs text-gray2 mb-4">Quantos criaram conta vs. quantos pagaram</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={signupsVsSubsData}>
              <CartesianGrid stroke="#1A2358" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#8A93B2" style={{ fontSize: 11 }} />
              <YAxis stroke="#8A93B2" style={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0F1A52", border: "1px solid #1A2358", borderRadius: 8 }}
                labelStyle={{ color: "#F4F6FF" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Signups" fill="#3B82F6" />
              <Bar dataKey="Assinaturas" fill="#FFBA00" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cancellations Bar */}
        <div className="card p-6">
          <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
            <UserMinus className="text-red-400" size={18} />
            Cancelamentos por mês
          </h2>
          <p className="text-xs text-gray2 mb-4">Subscriptions canceladas</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cancellationsData}>
              <CartesianGrid stroke="#1A2358" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#8A93B2" style={{ fontSize: 11 }} />
              <YAxis stroke="#8A93B2" style={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0F1A52", border: "1px solid #1A2358", borderRadius: 8 }}
                labelStyle={{ color: "#F4F6FF" }}
              />
              <Bar dataKey="Cancelamentos" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie + Funil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição por plano */}
        <div className="card p-6">
          <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
            <PieIcon className="text-orange" size={18} />
            Distribuição por plano
          </h2>
          <p className="text-xs text-gray2 mb-4">% de assinantes ativos por tier</p>
          {planDistData.length === 0 ? (
            <p className="text-center text-gray2 italic py-12">Nenhum assinante ativo</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={planDistData} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" outerRadius={80}
                     label={(entry) => `${entry.name}: ${entry.value}`}>
                  {planDistData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0F1A52", border: "1px solid #1A2358", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Funil de conversão */}
        <div className="card p-6">
          <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
            <Target className="text-orange" size={18} />
            Funil signup → pago (últimos 90 dias)
          </h2>
          <p className="text-xs text-gray2 mb-6">Onde você perde clientes</p>

          <div className="space-y-3">
            <FunnelBar
              label="Signups"
              value={funnel.total_signups}
              total={funnel.total_signups || 1}
              color="#3B82F6"
            />
            <FunnelBar
              label="Iniciaram checkout"
              value={funnel.started_checkout}
              total={funnel.total_signups || 1}
              color="#8B5CF6"
            />
            <FunnelBar
              label="Pagando ativos"
              value={funnel.active_paying}
              total={funnel.total_signups || 1}
              color="#FFBA00"
              highlight
            />
            <FunnelBar
              label="Cancelaram"
              value={funnel.churned}
              total={funnel.total_signups || 1}
              color="#EF4444"
            />
          </div>

          <p className="text-xs text-gray2 mt-6 text-center">
            Taxa de conversão final: <strong className="text-orange text-lg">{conversionRate}%</strong>
          </p>
        </div>
      </div>

      {/* Dica */}
      <div className="card p-4 bg-navy4/30 border-border">
        <p className="text-xs text-light/80">
          💡 <strong>Benchmarks SaaS B2B</strong>: MRR crescendo 10-15%/mês = saudável ·
          Churn &lt; 3%/mês = bom · Conversão signup→pago 15-25% = média do mercado ·
          ARR/MRR fica menor que 12× se tem muito downgrade ou cancelamento.
        </p>
      </div>
    </div>
  );
}

function KpiBig({ label, value, icon, hint, trend, variant, highlight }: any) {
  const isDanger = variant === "danger";
  const isWarning = variant === "warning";
  return (
    <div className={`card p-4 ${
      isDanger ? "border-red-500/40 bg-red-500/5" :
      isWarning ? "border-orange/40 bg-orange/5" :
      highlight ? "border-orange/40 bg-orange/5" : ""
    }`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-gray2">
        <span className={
          isDanger ? "text-red-400" :
          isWarning ? "text-orange" :
          highlight ? "text-orange" : "text-gray2"
        }>{icon}</span>
        {label}
      </div>
      <p className={`font-display font-extrabold text-2xl mt-2 ${
        isDanger ? "text-red-400" : "text-light"
      }`}>{value}</p>
      {trend !== undefined && (
        <p className={`text-[10px] mt-1 font-bold flex items-center gap-1 ${
          trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-gray2"
        }`}>
          {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : null}
          {trend > 0 ? "+" : ""}{trend.toFixed(1)}% vs mês anterior
        </p>
      )}
      {hint && <p className="text-[10px] text-gray2 mt-1">{hint}</p>}
    </div>
  );
}

function FunnelBar({ label, value, total, color, highlight }: any) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className={`text-sm ${highlight ? "text-orange font-bold" : "text-light/80"}`}>
          {label}
        </span>
        <span className={`text-sm font-bold ${highlight ? "text-orange" : "text-light/80"}`}>
          {value} <span className="text-gray2 text-xs">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-navy4 rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
