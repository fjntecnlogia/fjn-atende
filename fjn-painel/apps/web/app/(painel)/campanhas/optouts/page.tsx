"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ArrowLeft, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { maskPhone, relativeTime } from "@/lib/utils";

const sourceLabels: Record<string, { label: string; variant: any }> = {
  user_replied_stop: { label: "Cliente pediu PARAR", variant: "closed" },
  manual_admin:      { label: "Admin removeu manual", variant: "pending" },
  bounce:            { label: "Bounce (não entregue)", variant: "default" },
  import:            { label: "Já veio na importação", variant: "default" },
};

export default function OptOutsPage() {
  const qc = useQueryClient();
  const [showManual, setShowManual] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualReason, setManualReason] = useState("");

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["optout-events"],
    queryFn: async () =>
      (await api.get("/contact-lists/_meta/optout-events?limit=100")).data,
    refetchInterval: 15_000,
  });

  async function submitManual() {
    if (!manualPhone.trim()) return;
    try {
      const r = await api.post("/contact-lists/_meta/manual-optout", {
        phone: manualPhone,
        reason: manualReason || undefined,
      });
      toast.success(
        `Removido de ${r.data.lists_updated} listas (${r.data.campaigns_canceled} envios cancelados)`,
      );
      setManualPhone(""); setManualReason(""); setShowManual(false);
      qc.invalidateQueries({ queryKey: ["optout-events"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  // KPIs
  const today = events.filter((e) =>
    new Date(e.created_at).toDateString() === new Date().toDateString(),
  ).length;
  const last7d = events.filter((e) =>
    new Date(e.created_at).getTime() > Date.now() - 7 * 24 * 3600 * 1000,
  ).length;
  const byUser = events.filter((e) => e.source === "user_replied_stop").length;
  const byAdmin = events.filter((e) => e.source === "manual_admin").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/campanhas" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
            <ArrowLeft size={12} /> Campanhas
          </Link>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3 mt-1">
            <Ban className="text-orange" />
            Opt-outs
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Contatos que pediram pra não receber mais mensagens (LGPD)
          </p>
        </div>
        <button onClick={() => setShowManual(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Remover manualmente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Hoje" value={today} color="text-orange" />
        <Kpi label="Últimos 7 dias" value={last7d} color="text-light" />
        <Kpi label="Por pedido do cliente" value={byUser} color="text-red-400" />
        <Kpi label="Por admin" value={byAdmin} color="text-gray2" />
      </div>

      {/* Modal manual */}
      {showManual && (
        <div className="card p-5 border-orange/30 bg-orange/5">
          <h3 className="font-display font-bold mb-3">Remover manualmente</h3>
          <p className="text-xs text-gray2 mb-3">
            Use quando o cliente pediu opt-out por outro canal (e-mail, telefone, presencial).
            Remove de TODAS as listas e cancela envios pendentes.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Telefone com DDI (55...)"
                   value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
            <input className="input" placeholder="Motivo (opcional)"
                   value={manualReason} onChange={(e) => setManualReason(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowManual(false)} className="btn-ghost">Cancelar</button>
            <button onClick={submitManual} className="btn-primary">Remover</button>
          </div>
        </div>
      )}

      {/* Info LGPD */}
      <div className="card p-4 bg-orange/5 border-orange/30">
        <p className="text-xs text-light/90">
          💡 <strong>Como funciona:</strong> quando alguém responde <code>PARAR</code>, <code>SAIR</code>,{" "}
          <code>STOP</code>, <code>CANCELAR</code> ou variações no seu WhatsApp,
          é automaticamente removido de <strong>todas as listas</strong> e os próximos envios
          em campanhas ativas são cancelados. Recebe confirmação automática. <strong>Cumpre LGPD.</strong>
        </p>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Eventos de opt-out (últimos 90 dias)</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              <th className="text-left p-3 label">Telefone</th>
              <th className="text-left p-3 label">Origem</th>
              <th className="text-right p-3 label">Listas afetadas</th>
              <th className="text-right p-3 label">Envios cancelados</th>
              <th className="text-right p-3 label">Quando</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const s = sourceLabels[e.source] ?? { label: e.source, variant: "default" };
              return (
                <tr key={e.id} className="border-t border-border/40">
                  <td className="p-3 font-mono text-xs">{maskPhone(e.phone)}</td>
                  <td className="p-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                  <td className="p-3 text-right font-semibold">{e.lists_updated_count}</td>
                  <td className="p-3 text-right text-orange">{e.campaigns_affected}</td>
                  <td className="p-3 text-right text-xs text-gray2">{relativeTime(e.created_at)}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray2 text-sm">
                Sem opt-outs registrados. Bom sinal! 🎉
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray2">{label}</p>
      <p className={`font-display font-extrabold text-3xl ${color} mt-1`}>{value}</p>
    </div>
  );
}
