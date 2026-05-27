"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check, Star, Crown, Zap, Sparkles, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Plan {
  id: number;
  slug: string;
  name: string;
  tier: "pro" | "pro_plus";
  billing_cycle: "monthly" | "annual";
  price_cents: number;
  max_instances: number;
  max_users: number;
  included_ai_messages: number;
  features: Record<string, boolean>;
}

function money(c: number) { return (c / 100).toFixed(2).replace(".", ","); }
function moneyPerMonth(p: Plan) {
  if (p.billing_cycle === "annual") return money(p.price_cents / 12);
  return money(p.price_cents);
}

export default function PlanosPage() {
  const router = useRouter();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const { data: plansData, error: plansError } = useQuery<{ items: Plan[] }>({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
    retry: false,
  });

  const { data: subData } = useQuery<any>({
    queryKey: ["subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data,
    retry: false,
  });

  // Fallback se backend ainda não tem a migration 11 aplicada
  if (plansError) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Crown size={48} className="text-orange mx-auto" />
        <h1 className="font-display text-2xl font-extrabold text-light">
          Catálogo de planos indisponível
        </h1>
        <p className="text-gray2 text-sm">
          Aplique a migration <code className="bg-navy3 px-2 py-0.5 rounded">11_subscriptions.sql</code> no
          banco e reinicie o servidor.
        </p>
      </div>
    );
  }

  const plans = (plansData?.items ?? []).filter((p) => p.billing_cycle === cycle);
  const currentPlanId = subData?.has_subscription ? subData?.plan_slug : null;

  const checkoutMut = useMutation({
    mutationFn: async (slug: string) => (await api.post("/billing/checkout", { plan_slug: slug })).data,
    onMutate: (slug) => setLoadingSlug(slug),
    onSettled: () => setLoadingSlug(null),
    onSuccess: (data) => {
      if (data.checkout_url) window.location.href = data.checkout_url;
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao criar checkout"),
  });

  const changeMut = useMutation({
    mutationFn: async (slug: string) => (await api.post("/billing/change-plan", { plan_slug: slug })).data,
    onSuccess: (data) => {
      toast.success(`Plano alterado pra ${data.new_plan}!`);
      router.refresh();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao trocar"),
  });

  function handleSubscribe(plan: Plan) {
    if (subData?.has_subscription && subData?.status === "active") {
      if (confirm(`Mudar do plano "${subData.plan_name}" para "${plan.name}"?`)) {
        changeMut.mutate(plan.slug);
      }
    } else {
      checkoutMut.mutate(plan.slug);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold text-light">
          Escolha seu plano
        </h1>
        <p className="text-gray2 mt-2 text-lg">
          Cancele quando quiser. Sem fidelidade.
        </p>
      </div>

      {/* Toggle Mensal/Anual */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setCycle("monthly")}
          className={`px-4 py-2 rounded-full text-sm font-bold transition ${
            cycle === "monthly" ? "bg-orange text-navy2" : "text-gray2 hover:text-light"
          }`}>
          Mensal
        </button>
        <button
          onClick={() => setCycle("annual")}
          className={`px-4 py-2 rounded-full text-sm font-bold transition ${
            cycle === "annual" ? "bg-orange text-navy2" : "text-gray2 hover:text-light"
          }`}>
          Anual <span className="text-[10px] ml-1 opacity-80">-20% OFF</span>
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const isProPlus = plan.tier === "pro_plus";
          const isCurrent = plan.slug === currentPlanId;
          const isLoading = loadingSlug === plan.slug;

          return (
            <div key={plan.id}
                 className={`relative card p-8 transition-all ${
                   isProPlus ? "border-orange shadow-xl shadow-orange/10" : ""
                 } ${isCurrent ? "ring-2 ring-orange" : ""}`}>
              {isProPlus && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange text-navy2 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                  Mais popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-4 right-4">
                  <Star size={20} className="text-orange fill-orange" />
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                {isProPlus ? <Crown className="text-orange" /> : <Zap className="text-orange" />}
                <h2 className="font-display text-2xl font-extrabold text-light">{plan.name.replace(" (20% off)", "")}</h2>
              </div>

              <div className="my-6">
                <p className="font-display font-extrabold text-light">
                  <span className="text-sm text-gray2">R$</span>{" "}
                  <span className="text-5xl">{moneyPerMonth(plan).split(",")[0]}</span>
                  <span className="text-2xl">,{moneyPerMonth(plan).split(",")[1]}</span>
                  <span className="text-sm text-gray2 font-normal">/mês</span>
                </p>
                {plan.billing_cycle === "annual" && (
                  <p className="text-xs text-gray2 mt-1">
                    R$ {money(plan.price_cents)} cobrados anualmente
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 text-sm">
                <Feat ok>{plan.max_instances} {plan.max_instances === 1 ? "instância" : "instâncias"} WhatsApp</Feat>
                <Feat ok>Até {plan.max_users} usuários no time</Feat>
                <Feat ok>{plan.included_ai_messages.toLocaleString("pt-BR")} mensagens IA inclusas/mês</Feat>
                <Feat ok>Funil de atendimento (Kanban + drag-drop)</Feat>
                <Feat ok={plan.features.multipipeline}>Múltiplos pipelines</Feat>
                <Feat ok={plan.features.advanced_metrics}>Métricas avançadas + forecast</Feat>
                <Feat ok={plan.features.api_access}>Acesso à API</Feat>
                <Feat ok={plan.features.custom_branding}>Branding personalizado</Feat>
                <Feat ok={plan.features.priority_support}>Suporte prioritário</Feat>
              </ul>

              {isCurrent ? (
                <button disabled className="btn-ghost w-full opacity-60 cursor-not-allowed">
                  ✓ Plano atual
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading || changeMut.isPending}
                  className={`w-full ${isProPlus ? "btn-primary" : "btn-ghost"}`}>
                  {isLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> :
                   subData?.has_subscription && subData?.status === "active"
                     ? "Mudar pra este plano"
                     : "Assinar agora"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Excedente */}
      <div className="card p-5 bg-navy4/40 border-border">
        <p className="text-sm text-light/80">
          💡 <strong>Excedeu a cota mensal?</strong> Mensagens extras são cobradas
          do seu <strong className="text-orange">crédito pré-pago</strong> (R$ 0,03 por mensagem).
          Recarregue em <a href="/creditos/comprar" className="text-orange hover:underline">/creditos/comprar</a>.
        </p>
      </div>
    </div>
  );
}

function Feat({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? "text-light" : "text-gray2/60 line-through"}`}>
      <Check size={16} className={ok ? "text-green-400 mt-0.5 flex-shrink-0" : "text-gray2/40 mt-0.5 flex-shrink-0"} />
      <span>{children}</span>
    </li>
  );
}
