"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Plus, Trash2, Save, X, Users, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Plan {
  id: number;
  slug: string;
  name: string;
  tier: "pro" | "pro_plus" | "enterprise";
  billing_cycle: "monthly" | "annual";
  price_cents: number;
  stripe_price_id: string | null;
  max_instances: number;
  max_users: number;
  max_pipelines: number;
  max_teams: number;
  included_ai_messages: number;
  included_campaign_msgs: number;
  features: Record<string, boolean>;
  is_active: boolean;
  sort_order: number;
  subscribers_count: number;
}

const featureList: Array<{ key: string; label: string }> = [
  { key: "multipipeline",      label: "Múltiplos pipelines" },
  { key: "advanced_metrics",   label: "Métricas avançadas" },
  { key: "api_access",         label: "Acesso à API" },
  { key: "custom_branding",    label: "Branding personalizado" },
  { key: "white_label",        label: "White-label completo" },
  { key: "priority_support",   label: "Suporte prioritário" },
];

export default function AdminPlanosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: plansData } = useQuery<{ items: Plan[] }>({
    queryKey: ["admin-plans"],
    queryFn: async () => (await api.get("/billing/admin/plans")).data,
  });

  const updateMut = useMutation({
    mutationFn: async (p: Plan) => {
      const payload: any = { ...p };
      delete payload.id;
      delete payload.subscribers_count;
      delete payload.stripe_price_id;
      delete payload.created_at;
      return (await api.put(`/billing/admin/plans/${p.id}`, payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      setEditing(null);
      toast.success("Plano atualizado!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const createMut = useMutation({
    mutationFn: async (p: Partial<Plan>) =>
      (await api.post(`/billing/admin/plans`, p)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setShowNew(false);
      toast.success("Plano criado!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/billing/admin/plans/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plano desativado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Crown className="text-orange" />
            Gestão de Planos
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Editar preços, limites e features. Mudanças em preço criam novo Stripe Price (clientes ativos não são afetados).
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Novo plano
        </button>
      </div>

      {/* Avisos */}
      <div className="card p-4 bg-orange/5 border-orange/30">
        <p className="text-xs text-light/90">
          ⚠️ <strong>Stripe Price imutável:</strong> ao mudar valor, o sistema cria um novo Price na próxima
          assinatura. Clientes ativos continuam pagando o preço antigo até trocarem de plano.
        </p>
      </div>

      {/* Modal de criação */}
      {showNew && (
        <PlanFormModal
          title="Criar novo plano"
          onClose={() => setShowNew(false)}
          onSave={(p) => createMut.mutate(p)}
          loading={createMut.isPending}
        />
      )}

      {/* Modal de edição */}
      {editing && (
        <PlanFormModal
          title={`Editar: ${editing.name}`}
          plan={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => updateMut.mutate({ ...editing, ...p })}
          loading={updateMut.isPending}
        />
      )}

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-gray2">
              <th className="p-3 font-bold">Plano</th>
              <th className="p-3 font-bold">Ciclo</th>
              <th className="p-3 font-bold">Preço</th>
              <th className="p-3 font-bold">Limites</th>
              <th className="p-3 font-bold">Cota IA/mês</th>
              <th className="p-3 font-bold">Assinantes</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(plansData?.items ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-white/3">
                <td className="p-3">
                  <p className="font-bold text-light">{p.name}</p>
                  <p className="text-[10px] text-gray2">{p.slug} · {p.tier}</p>
                </td>
                <td className="p-3 text-light/80">
                  {p.billing_cycle === "annual" ? "Anual" : "Mensal"}
                </td>
                <td className="p-3 font-display font-bold text-orange">
                  R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                </td>
                <td className="p-3 text-xs text-gray2">
                  {p.max_instances} inst · {p.max_users} users<br/>
                  {p.max_pipelines} funis · {p.max_teams} times
                </td>
                <td className="p-3 text-light/80">
                  {p.included_ai_messages.toLocaleString("pt-BR")}
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Users size={11} className="text-gray2" />
                    {p.subscribers_count}
                  </span>
                </td>
                <td className="p-3">
                  {p.is_active ? (
                    <span className="text-[10px] uppercase tracking-widest font-bold bg-green-500/15 text-green-400 px-2 py-1 rounded-full">
                      Ativo
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest font-bold bg-gray2/15 text-gray2 px-2 py-1 rounded-full">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditing(p)}
                            className="px-3 py-1 text-xs text-orange hover:bg-orange/10 rounded transition-colors">
                      Editar
                    </button>
                    {p.is_active && (
                      <button onClick={() => {
                        if (confirm(`Desativar plano "${p.name}"? Não aparecerá pra novos clientes.`)) deleteMut.mutate(p.id);
                      }}
                              className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
// Modal de criar/editar
// =====================================================================
function PlanFormModal({
  title, plan, onClose, onSave, loading,
}: {
  title: string;
  plan?: Plan;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<any>({
    slug: plan?.slug ?? "",
    name: plan?.name ?? "",
    tier: plan?.tier ?? "pro",
    billing_cycle: plan?.billing_cycle ?? "monthly",
    price_reais: plan ? (plan.price_cents / 100).toFixed(2) : "",
    max_instances: plan?.max_instances ?? 1,
    max_users: plan?.max_users ?? 3,
    max_pipelines: plan?.max_pipelines ?? 1,
    max_teams: plan?.max_teams ?? 0,
    included_ai_messages: plan?.included_ai_messages ?? 1000,
    included_campaign_msgs: plan?.included_campaign_msgs ?? 1000,
    features: plan?.features ?? {},
    is_active: plan?.is_active ?? true,
    sort_order: plan?.sort_order ?? 99,
  });

  function update(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  function toggleFeature(key: string) {
    setForm((f: any) => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }));
  }

  function handleSave() {
    const data = { ...form };
    data.price_cents = Math.round(parseFloat(String(form.price_reais).replace(",", ".")) * 100);
    delete data.price_reais;
    onSave(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4" onClick={onClose}>
      <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <Sparkles className="text-orange" size={18} />
            {title}
          </h2>
          <button onClick={onClose} className="text-gray2 hover:text-light">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Linha 1 — identificação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Slug (interno)</label>
              <input className="input w-full font-mono text-sm" placeholder="ex: pro_monthly"
                     value={form.slug} onChange={(e) => update("slug", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">Nome (visível)</label>
              <input className="input w-full" placeholder="Ex: Pro Mensal"
                     value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
          </div>

          {/* Linha 2 — tier + ciclo + preço */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label block mb-1">Tier</label>
              <select className="input w-full" value={form.tier} onChange={(e) => update("tier", e.target.value)}>
                <option value="pro">Pro</option>
                <option value="pro_plus">Pro+</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Ciclo</label>
              <select className="input w-full" value={form.billing_cycle} onChange={(e) => update("billing_cycle", e.target.value)}>
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Preço (R$)</label>
              <input className="input w-full" type="text" placeholder="99,00"
                     value={form.price_reais} onChange={(e) => update("price_reais", e.target.value)} />
            </div>
          </div>

          {/* Linha 3 — limites estruturais */}
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-gray2 mb-2">Limites estruturais</p>
            <div className="grid grid-cols-4 gap-3">
              <NumInput label="Instâncias" value={form.max_instances} onChange={(v) => update("max_instances", v)} />
              <NumInput label="Usuários" value={form.max_users} onChange={(v) => update("max_users", v)} />
              <NumInput label="Funis" value={form.max_pipelines} onChange={(v) => update("max_pipelines", v)} />
              <NumInput label="Times" value={form.max_teams} onChange={(v) => update("max_teams", v)} />
            </div>
          </div>

          {/* Linha 4 — cotas */}
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-gray2 mb-2">Cota mensal (excedente cobra do crédito)</p>
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Mensagens IA" value={form.included_ai_messages} onChange={(v) => update("included_ai_messages", v)} />
              <NumInput label="Mensagens campanha" value={form.included_campaign_msgs} onChange={(v) => update("included_campaign_msgs", v)} />
            </div>
          </div>

          {/* Linha 5 — features */}
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-gray2 mb-2">Features inclusas</p>
            <div className="grid grid-cols-2 gap-2">
              {featureList.map((f) => (
                <label key={f.key} className="flex items-center gap-2 bg-navy3 p-2 rounded cursor-pointer hover:bg-navy3/70">
                  <input type="checkbox"
                         checked={!!form.features?.[f.key]}
                         onChange={() => toggleFeature(f.key)}
                         className="accent-orange" />
                  <span className="text-sm text-light">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Linha 6 — ativo + ordem */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active}
                     onChange={(e) => update("is_active", e.target.checked)}
                     className="accent-orange" />
              <span className="text-sm text-light">Plano ativo (visível no /planos)</span>
            </label>
            <NumInput label="Ordem (sort)" value={form.sort_order} onChange={(v) => update("sort_order", v)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={loading}
                  className="btn-primary flex items-center gap-2">
            <Save size={14} />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label block mb-1 text-xs">{label}</label>
      <input className="input w-full text-sm" type="number" min={0}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
