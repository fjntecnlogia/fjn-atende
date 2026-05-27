"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Gift, History, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";

function formatCents(c: number | string): string {
  return `R$ ${(Number(c) / 100).toFixed(2).replace(".", ",")}`;
}

const kindLabels: Record<string, { label: string; color: string; icon: any }> = {
  purchase: { label: "Compra", color: "text-green-400", icon: ArrowDownToLine },
  bonus:    { label: "Bônus", color: "text-orange", icon: Gift },
  refund:   { label: "Reembolso", color: "text-green-400", icon: ArrowDownToLine },
  manual:   { label: "Ajuste manual", color: "text-gray2", icon: ArrowDownToLine },
  debit:    { label: "Débito", color: "text-red-400", icon: ArrowUpFromLine },
};

export default function CreditosPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: balance } = useQuery<any>({
    queryKey: ["credits-me"],
    queryFn: async () => (await api.get("/credits/me")).data,
    refetchInterval: 15_000,
  });

  const { data: tx = [] } = useQuery<any[]>({
    queryKey: ["credits-tx"],
    queryFn: async () => (await api.get("/credits/transactions?limit=100")).data,
    refetchInterval: 15_000,
  });

  // Toast quando volta do Stripe Checkout
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      toast.success("Pagamento recebido! Crédito sendo aplicado...", { duration: 6000 });
      qc.invalidateQueries({ queryKey: ["credits-me"] });
      qc.invalidateQueries({ queryKey: ["credits-tx"] });
      router.replace("/creditos");
    } else if (status === "canceled") {
      toast("Pagamento cancelado", { icon: "⚠️" });
      router.replace("/creditos");
    }
  }, [params, router, qc]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Wallet className="text-orange" />
            Créditos
          </h1>
          <p className="text-sm text-gray2 mt-1">Saldo pré-pago para envio de campanhas</p>
        </div>
        <Link href="/creditos/comprar" className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Comprar créditos
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Saldo disponível"
          value={balance ? formatCents(balance.balance_cents) : "—"}
          accent="orange"
          icon={<Wallet size={16} />}
        />
        <KpiCard
          label="Total comprado"
          value={balance ? formatCents(balance.total_purchased_cents) : "—"}
          accent="green"
          icon={<ArrowDownToLine size={16} />}
        />
        <KpiCard
          label="Total gasto"
          value={balance ? formatCents(balance.total_spent_cents) : "—"}
          accent="purple"
          icon={<ArrowUpFromLine size={16} />}
        />
      </div>

      {/* Tarifas vigentes */}
      <div className="card p-6">
        <h3 className="font-semibold text-sm mb-3">Tarifas por mensagem</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {(balance?.pricing ?? []).map((p: any) => (
            <div key={p.provider} className="bg-navy2/60 border border-border rounded-lg p-3">
              <p className="text-xs text-gray2 uppercase tracking-widest">{p.provider}</p>
              <p className="font-display font-extrabold text-xl text-orange mt-1">
                {formatCents(p.price_cents)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-orange/5 border border-orange/30 rounded-lg text-xs text-light/80">
          💡 Recarga manual: peça pro admin FJN adicionar crédito. Integração com Pagar.me em breve
          (pagamento via PIX/cartão).
        </div>
      </div>

      {/* Histórico */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <History size={14} className="text-orange" />
          <h3 className="font-semibold text-sm">Histórico de transações</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              <th className="text-left p-3 label">Tipo</th>
              <th className="text-left p-3 label">Descrição</th>
              <th className="text-right p-3 label">Valor</th>
              <th className="text-right p-3 label">Saldo após</th>
              <th className="text-right p-3 label">Data</th>
            </tr>
          </thead>
          <tbody>
            {tx.map((t) => {
              const meta = kindLabels[t.kind] ?? { label: t.kind, color: "text-light", icon: History };
              const Icon = meta.icon;
              const isPositive = Number(t.amount_cents) > 0;
              return (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={meta.color} />
                      <span className={meta.color}>{meta.label}</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-light/80 max-w-md truncate">{t.description ?? "—"}</td>
                  <td className={`p-3 text-right font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{formatCents(t.amount_cents)}
                  </td>
                  <td className="p-3 text-right text-gray2">{formatCents(t.balance_after_cents)}</td>
                  <td className="p-3 text-right text-xs text-gray2">
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              );
            })}
            {tx.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray2 text-sm">Sem transações</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
