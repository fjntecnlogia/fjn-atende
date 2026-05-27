"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Sparkles, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

const moneyBr = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export default function ComprarCreditoPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState<number>(0);
  const [methods, setMethods] = useState<("card" | "pix" | "boleto")[]>(["card", "pix"]);
  const [loading, setLoading] = useState(false);

  const { data: paymentCfg } = useQuery<any>({
    queryKey: ["payment-config"],
    queryFn: async () => (await api.get("/credits/payment-config")).data,
  });

  const packages = paymentCfg?.packages ?? [];
  const finalAmount = custom > 0 ? custom * 100 : selected ?? 0;
  const finalBonus = bonusFor(finalAmount);
  const totalCredit = finalAmount + finalBonus;

  function bonusFor(amount: number): number {
    if (amount >= 100000) return 20000;
    if (amount >= 50000) return 7500;
    if (amount >= 20000) return 2000;
    if (amount >= 10000) return 500;
    return 0;
  }

  async function checkout() {
    if (finalAmount < 1000) {
      toast.error("Valor mínimo é R$ 10");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/credits/checkout", {
        amount_cents: finalAmount,
        methods,
      });
      // Redireciona pro Stripe Checkout
      window.location.href = r.data.checkout_url;
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha no checkout");
      setLoading(false);
    }
  }

  if (paymentCfg && !paymentCfg.stripe_enabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link href="/creditos" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
          <ArrowLeft size={12} /> Créditos
        </Link>
        <h1 className="font-display text-3xl font-extrabold mt-1">Comprar créditos</h1>
        <div className="card p-6 mt-6 bg-orange/5 border-orange/30">
          <p className="font-semibold mb-2">💳 Pagamento online em configuração</p>
          <p className="text-sm text-light/80">
            A integração com Stripe ainda não foi habilitada. Por enquanto, fale direto com a equipe FJN
            pelo WhatsApp pra adicionar crédito manualmente.
          </p>
          <a href="https://wa.me/5565980900089"
             className="btn-primary mt-4 inline-flex items-center gap-2">
            Falar com FJN no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/creditos" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
          <ArrowLeft size={12} /> Créditos
        </Link>
        <h1 className="font-display text-3xl font-extrabold mt-1 flex items-center gap-3">
          <CreditCard className="text-orange" />
          Comprar créditos
        </h1>
        <p className="text-sm text-gray2 mt-1">PIX, cartão ou boleto via Stripe</p>
      </div>

      {/* Pacotes pré-definidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {packages.map((pkg: any) => {
          const isSelected = selected === pkg.amount_cents && custom === 0;
          return (
            <button
              key={pkg.amount_cents}
              onClick={() => { setSelected(pkg.amount_cents); setCustom(0); }}
              className={`card p-5 text-left transition-all ${
                isSelected ? "border-orange bg-orange/5" : "hover:border-orange/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-extrabold text-2xl text-light">{pkg.label}</p>
                  <p className="text-xs text-gray2 mt-1">{pkg.description}</p>
                </div>
                {pkg.bonus_cents > 0 && (
                  <div className="bg-orange/20 border border-orange/40 rounded-full px-2 py-1 flex items-center gap-1">
                    <Sparkles size={10} className="text-orange" />
                    <span className="text-[10px] font-bold text-orange">
                      +{moneyBr(pkg.bonus_cents)}
                    </span>
                  </div>
                )}
              </div>
              {pkg.bonus_cents > 0 && (
                <p className="text-xs text-green-400 mt-2">
                  Total creditado: <strong>{moneyBr(pkg.amount_cents + pkg.bonus_cents)}</strong>
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Valor custom */}
      <div className="card p-5">
        <label className="label">Outro valor (em reais)</label>
        <div className="flex gap-2 items-center mt-2">
          <span className="text-light/60">R$</span>
          <input
            type="number"
            min={10}
            max={10000}
            placeholder="50"
            className="input flex-1"
            value={custom || ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCustom(v);
              if (v > 0) setSelected(null);
            }}
          />
        </div>
        <p className="text-[10px] text-gray2 mt-1">Mínimo R$ 10, máximo R$ 10.000</p>
      </div>

      {/* Métodos de pagamento */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-3">Método de pagamento</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["pix", "card", "boleto"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMethods((prev) =>
                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                );
              }}
              className={`p-3 rounded-lg border text-sm font-semibold transition-colors ${
                methods.includes(m)
                  ? "border-orange bg-orange/10 text-orange"
                  : "border-border text-light/60 hover:text-light"
              }`}
            >
              {m === "pix" && "🇧🇷 PIX (instantâneo)"}
              {m === "card" && "💳 Cartão"}
              {m === "boleto" && "📄 Boleto"}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      {finalAmount > 0 && (
        <div className="card p-5 bg-orange/5 border-orange/30">
          <h3 className="font-display font-bold mb-3">Resumo</h3>
          <div className="space-y-1 text-sm">
            <Row label="Valor pago" value={moneyBr(finalAmount)} />
            {finalBonus > 0 && (
              <Row label="Bônus FJN" value={`+${moneyBr(finalBonus)}`} highlight="text-green-400" />
            )}
            <div className="border-t border-orange/30 pt-2 mt-2 flex justify-between">
              <span className="font-bold">Total creditado</span>
              <span className="font-display font-extrabold text-2xl text-orange">{moneyBr(totalCredit)}</span>
            </div>
          </div>
          <button
            onClick={checkout}
            disabled={loading || methods.length === 0}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3"
          >
            <ShieldCheck size={16} />
            {loading ? "Abrindo pagamento..." : `Pagar ${moneyBr(finalAmount)} via Stripe`}
          </button>
          <p className="text-[10px] text-gray2 text-center mt-3">
            🔒 Pagamento seguro via Stripe. Cartões internacionais aceitos.
            PIX é confirmado em segundos. Boletos em até 2 dias úteis.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray2">{label}</span>
      <span className={`font-semibold ${highlight ?? "text-light"}`}>{value}</span>
    </div>
  );
}
