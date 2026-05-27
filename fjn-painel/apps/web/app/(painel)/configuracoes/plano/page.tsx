"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Zap, Calendar, AlertTriangle, ExternalLink, XCircle,
  RefreshCw, Sparkles, MessageSquare, Megaphone,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

function money(c: number) {
  return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export default function ConfiguracoesPlanoPage() {
  const qc = useQueryClient();
  const { data: sub } = useQuery<any>({
    queryKey: ["subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data,
    refetchInterval: 30_000,
  });

  const cancelMut = useMutation({
    mutationFn: async () => (await api.post("/billing/cancel")).data,
    onSuccess: () => {
      toast.success("Assinatura cancelada ao fim do período");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const reactivateMut = useMutation({
    mutationFn: async () => (await api.post("/billing/reactivate")).data,
    onSuccess: () => {
      toast.success("Assinatura reativada!");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const portalMut = useMutation({
    mutationFn: async () => (await api.post("/billing/portal")).data,
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  if (!sub) return <div className="p-8 text-gray2">Carregando...</div>;

  if (!sub.has_subscription) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Crown size={48} className="text-orange mx-auto" />
        <h1 className="font-display text-3xl font-extrabold">Sem plano ativo</h1>
        <p className="text-gray2">
          Sua conta ainda não tem uma assinatura. Escolha um plano pra começar a usar.
        </p>
        <Link href="/planos" className="btn-primary inline-block">
          Ver planos
        </Link>
      </div>
    );
  }

  const isProPlus = sub.plan_tier === "pro_plus";
  const isPastDue = sub.status === "past_due";
  const aiUsedPct = Math.round((sub.ai_messages_used / sub.included_ai_messages) * 100);
  const campaignUsedPct = Math.round((sub.campaign_msgs_used / sub.included_campaign_msgs) * 100);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Crown className="text-orange" />
          Sua assinatura
        </h1>
      </div>

      {/* Banner past_due */}
      {isPastDue && (
        <div className="card p-4 bg-red-500/10 border-red-500/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-red-400">Pagamento pendente</p>
              <p className="text-sm text-light/80 mt-1">
                Sua última cobrança falhou. Atualize seu método de pagamento pra desbloquear o acesso.
              </p>
              <button onClick={() => portalMut.mutate()}
                      className="btn-primary mt-3 text-sm">
                Atualizar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card do plano */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isProPlus ? <Crown className="text-orange" size={20} /> : <Zap className="text-orange" size={20} />}
              <h2 className="font-display text-2xl font-extrabold text-light">{sub.plan_name}</h2>
            </div>
            <p className="text-sm text-gray2">
              {money(sub.price_cents)} / {sub.billing_cycle === "annual" ? "ano" : "mês"}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-xs uppercase tracking-widest font-bold px-2 py-1 rounded-full ${
              sub.status === "active" ? "bg-green-500/15 text-green-400" :
              sub.status === "past_due" ? "bg-red-500/15 text-red-400" :
              "bg-gray2/15 text-gray2"
            }`}>
              {sub.status === "active" ? "Ativo" :
               sub.status === "past_due" ? "Pagamento pendente" :
               sub.status === "canceled" ? "Cancelado" : sub.status}
            </span>
            {sub.cancel_at_period_end && (
              <p className="text-xs text-orange mt-1">Cancela em {fmtDate(sub.current_period_end)}</p>
            )}
          </div>
        </div>

        {/* Período + renovação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-navy3 rounded-lg p-3 flex items-center gap-3">
            <Calendar size={16} className="text-orange" />
            <div>
              <p className="text-xs text-gray2">Próxima cobrança</p>
              <p className="text-sm font-semibold text-light">
                {sub.current_period_end ? fmtDate(sub.current_period_end) : "—"}
              </p>
            </div>
          </div>
          <div className="bg-navy3 rounded-lg p-3 flex items-center gap-3">
            <Sparkles size={16} className="text-orange" />
            <div>
              <p className="text-xs text-gray2">Ciclo atual</p>
              <p className="text-sm font-semibold text-light">
                {sub.days_until_renewal ?? 0} dias restantes
              </p>
            </div>
          </div>
        </div>

        {/* Cotas */}
        <div className="space-y-3 mb-6">
          <UsageBar
            icon={<MessageSquare size={14} />}
            label="Mensagens IA"
            used={sub.ai_messages_used}
            total={sub.included_ai_messages}
            pct={aiUsedPct}
          />
          <UsageBar
            icon={<Megaphone size={14} />}
            label="Mensagens de campanha"
            used={sub.campaign_msgs_used}
            total={sub.included_campaign_msgs}
            pct={campaignUsedPct}
          />
        </div>

        <p className="text-xs text-gray2 mb-4">
          💡 Excedentes são cobrados do seu <Link href="/creditos" className="text-orange hover:underline">crédito pré-pago</Link> (R$ 0,03/mensagem).
        </p>

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
          <Link href="/planos" className="btn-ghost text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Mudar de plano
          </Link>
          <button onClick={() => portalMut.mutate()} className="btn-ghost text-sm flex items-center gap-2">
            <ExternalLink size={14} /> Portal Stripe (faturas, cartão)
          </button>

          {sub.cancel_at_period_end ? (
            <button onClick={() => reactivateMut.mutate()} className="btn-ghost text-sm text-green-400 flex items-center gap-2">
              <RefreshCw size={14} /> Reativar assinatura
            </button>
          ) : sub.status === "active" && (
            <button
              onClick={() => {
                if (confirm("Cancelar ao fim do período? Você continua tendo acesso até " + fmtDate(sub.current_period_end))) {
                  cancelMut.mutate();
                }
              }}
              className="btn-ghost text-sm text-red-400 flex items-center gap-2 ml-auto">
              <XCircle size={14} /> Cancelar assinatura
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageBar({ icon, label, used, total, pct }: any) {
  const overLimit = used >= total;
  const warning = pct >= 80 && !overLimit;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs text-light/80">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`text-xs font-bold ${
          overLimit ? "text-red-400" : warning ? "text-orange" : "text-gray2"
        }`}>
          {used.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-2 bg-navy4 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            overLimit ? "bg-red-500" : warning ? "bg-orange" : "bg-green-500"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
