"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, ArrowLeft, ArrowRight, Rocket, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

export default function NovaCampanhaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({
    name: "",
    provider: "wppconnect",
    list_id: null,
    template_id: null,
    custom_body: "",
    rate_per_min: 10,
    jitter_seconds: 5,
    filters: { only_opted_in: true, exclude_opted_out: true },
    scheduled_at: null,
  });

  const { data: lists = [] } = useQuery<any[]>({
    queryKey: ["contact-lists"],
    queryFn: async () => (await api.get("/contact-lists")).data,
  });
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });
  const { data: credits } = useQuery<any>({
    queryKey: ["credits-me"],
    queryFn: async () => (await api.get("/credits/me")).data,
  });

  const selectedList = lists.find((l) => l.id === form.list_id);
  const selectedTemplate = templates.find((t) => t.id === form.template_id);
  const estimatedRecipients = selectedList?.optin_count ?? 0;
  const priceCents = (credits?.pricing ?? []).find((p: any) => p.provider === form.provider)?.price_cents ?? 5;
  const estimatedCostCents = estimatedRecipients * priceCents;
  const hasBalance = (credits?.balance_cents ?? 0) >= estimatedCostCents;

  async function createAndStart(startNow: boolean) {
    try {
      const r = await api.post("/campaigns", {
        ...form,
        template_id: form.template_id || undefined,
        custom_body: form.template_id ? undefined : form.custom_body,
      });
      const id = r.data.id;
      if (startNow) {
        await api.post(`/campaigns/${id}/prepare`);
        toast.success("Campanha iniciada! Envios começam em alguns segundos.");
      } else {
        toast.success("Campanha criada como rascunho");
      }
      router.push(`/campanhas/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/campanhas" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
          <ArrowLeft size={12} /> Campanhas
        </Link>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3 mt-1">
          <Megaphone className="text-orange" />
          Nova campanha
        </h1>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? "bg-orange" : "bg-navy4"}`} />
        ))}
      </div>

      {/* Step 1: Nome + provider */}
      {step === 1 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-xl">1. Identificação</h2>
          <div>
            <label className="label">Nome da campanha</label>
            <input className="input w-full mt-1" placeholder="Ex: Black Friday 2026"
                   value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">Provider (canal de envio)</label>
            <select className="input w-full mt-1" value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              <option value="wppconnect">WPP-Connect (próprio)</option>
              <option value="meta_cloud" disabled={!credits?.pricing?.find((p:any) => p.provider === "meta_cloud")}>
                Meta Cloud API (oficial)
              </option>
            </select>
            <p className="text-[10px] text-gray2 mt-1">
              Tarifa: R$ {(priceCents / 100).toFixed(2)}/msg
            </p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!form.name.trim()} className="btn-primary flex items-center gap-2">
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Lista */}
      {step === 2 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-xl">2. Para quem enviar</h2>
          {lists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray2 text-sm mb-3">Você ainda não tem listas de contatos</p>
              <Link href="/campanhas/listas" className="btn-primary inline-flex items-center gap-2">
                Criar primeira lista
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map((l) => (
                <label key={l.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                    form.list_id === l.id ? "border-orange bg-orange/5" : "border-border hover:border-orange/30"
                  }`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="list" checked={form.list_id === l.id}
                           onChange={() => setForm({ ...form, list_id: l.id })} className="accent-orange" />
                    <div>
                      <p className="font-semibold text-sm">{l.name}</p>
                      <p className="text-xs text-gray2">{l.optin_count} opt-in / {l.total_count} total</p>
                    </div>
                  </div>
                  <span className="text-xs text-orange font-bold">{l.optin_count} destinatários</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-ghost flex items-center gap-2">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button onClick={() => setStep(3)} disabled={!form.list_id} className="btn-primary flex items-center gap-2">
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Mensagem */}
      {step === 3 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-xl">3. Mensagem</h2>
          <div>
            <label className="label">Use um template ou escreva direto</label>
            <select className="input w-full mt-1" value={form.template_id ?? ""}
                    onChange={(e) => setForm({ ...form, template_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— Escrever mensagem direta —</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>

          {form.template_id ? (
            <div className="bg-navy2/60 border border-border rounded-lg p-3">
              <p className="text-xs text-gray2 mb-1">Preview do template</p>
              <p className="text-sm whitespace-pre-wrap font-mono">{selectedTemplate?.body}</p>
            </div>
          ) : (
            <div>
              <label className="label">Mensagem direta</label>
              <textarea className="input w-full mt-1 font-mono text-sm" rows={6}
                        placeholder="Olá {{nome|first}}!&#10;Tudo bem? Tenho uma novidade pra você..."
                        value={form.custom_body}
                        onChange={(e) => setForm({ ...form, custom_body: e.target.value })} />
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-ghost flex items-center gap-2">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button onClick={() => setStep(4)}
                    disabled={!form.template_id && !form.custom_body.trim()}
                    className="btn-primary flex items-center gap-2">
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Revisar e iniciar */}
      {step === 4 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-xl">4. Revisar e iniciar</h2>

          <div className="bg-navy2/60 border border-border rounded-lg p-4 space-y-2 text-sm">
            <Row label="Nome" value={form.name} />
            <Row label="Provider" value={form.provider} />
            <Row label="Lista" value={selectedList?.name} />
            <Row label="Destinatários estimados (opt-in)" value={`${estimatedRecipients}`} />
            <Row label="Custo estimado" value={`R$ ${(estimatedCostCents/100).toFixed(2)}`}
                 highlight={hasBalance ? "text-green-400" : "text-red-400"} />
            <Row label="Saldo atual" value={`R$ ${((credits?.balance_cents ?? 0)/100).toFixed(2)}`} />
          </div>

          {/* Anti-ban */}
          <div className="card p-3 bg-orange/5 border-orange/30">
            <h3 className="font-semibold text-xs flex items-center gap-1 text-orange">
              <AlertTriangle size={12} /> Anti-ban
            </h3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="label text-[10px]">Mensagens por minuto</label>
                <input type="number" min={1} max={30} className="input w-full mt-1 text-sm"
                       value={form.rate_per_min}
                       onChange={(e) => setForm({ ...form, rate_per_min: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label text-[10px]">Jitter (variação aleatória s)</label>
                <input type="number" min={0} max={60} className="input w-full mt-1 text-sm"
                       value={form.jitter_seconds}
                       onChange={(e) => setForm({ ...form, jitter_seconds: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-[10px] text-gray2 mt-2">
              Recomendado: 5-15 msgs/min com 3-8s de jitter. Evita banimento do WhatsApp.
            </p>
          </div>

          {!hasBalance && (
            <div className="card p-3 bg-red-500/10 border-red-500/30">
              <p className="text-xs text-red-300">
                ⚠️ <strong>Saldo insuficiente.</strong> Faltam R$ {((estimatedCostCents - (credits?.balance_cents ?? 0))/100).toFixed(2)}.
                A campanha vai pausar quando acabar o saldo.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="btn-ghost flex items-center gap-2">
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="flex gap-2">
              <button onClick={() => createAndStart(false)} className="btn-ghost">
                Salvar como rascunho
              </button>
              <button onClick={() => createAndStart(true)} className="btn-primary flex items-center gap-2">
                <Rocket size={14} /> Iniciar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: any; highlight?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray2">{label}</span>
      <span className={`font-semibold ${highlight ?? "text-light"}`}>{value ?? "—"}</span>
    </div>
  );
}
