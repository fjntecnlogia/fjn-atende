"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pause, Play, X, Rocket, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { relativeTime, maskPhone } from "@/lib/utils";

export default function CampanhaDetalhePage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();

  const { data: c, refetch } = useQuery<any>({
    queryKey: ["campaign", id],
    queryFn: async () => (await api.get(`/campaigns/${id}`)).data,
    refetchInterval: 3_000,
  });

  const { data: recipients = [] } = useQuery<any[]>({
    queryKey: ["campaign-recipients", id],
    queryFn: async () => (await api.get(`/campaigns/${id}/recipients?limit=200`)).data,
    refetchInterval: 3_000,
  });

  if (!c) return <div className="p-8 text-gray2">Carregando...</div>;

  const progress = c.total_count > 0
    ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100) : 0;

  async function action(path: string, label: string) {
    try {
      await api.post(`/campaigns/${id}/${path}`);
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/campanhas" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
            <ArrowLeft size={12} /> Campanhas
          </Link>
          <h1 className="font-display text-3xl font-extrabold mt-1">{c.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            <Badge>{c.provider}</Badge>
            {c.list_name && <span className="text-xs text-gray2">Lista: {c.list_name}</span>}
            {c.template_name && <span className="text-xs text-gray2">Template: {c.template_name}</span>}
          </div>
        </div>

        <div className="flex gap-2">
          {c.status === "draft" && (
            <button onClick={() => action("prepare", "Campanha iniciada!")}
                    className="btn-primary flex items-center gap-2">
              <Rocket size={14} /> Iniciar
            </button>
          )}
          {c.status === "running" && (
            <button onClick={() => action("pause", "Pausada")}
                    className="btn-ghost flex items-center gap-2">
              <Pause size={14} /> Pausar
            </button>
          )}
          {c.status === "paused" && (
            <button onClick={() => action("resume", "Retomada")}
                    className="btn-primary flex items-center gap-2">
              <Play size={14} /> Retomar
            </button>
          )}
          {["draft","running","paused","scheduled"].includes(c.status) && (
            <button onClick={() => action("cancel", "Cancelada")}
                    className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2">
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Progresso */}
      {c.total_count > 0 && (
        <div className="card p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">{c.sent_count + c.failed_count} de {c.total_count} processadas</span>
            <span className="font-display font-extrabold text-2xl text-orange">{progress}%</span>
          </div>
          <div className="h-3 bg-navy4 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange to-orange2 transition-all"
                 style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total" value={c.total_count} color="text-light" />
        <Kpi label="Pendentes" value={c.total_count - c.sent_count - c.failed_count - c.opted_out_count}
             color="text-gray2" icon={Clock} />
        <Kpi label="Enviadas" value={c.sent_count} color="text-green-400" icon={CheckCircle2} />
        <Kpi label="Falhas" value={c.failed_count} color="text-red-400" icon={XCircle} />
        <Kpi label="Opt-out" value={c.opted_out_count} color="text-orange" icon={AlertTriangle} />
      </div>

      {/* Lista de destinatários */}
      <div className="card overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Destinatários ({recipients.length}{recipients.length === 200 && "+"})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              <th className="text-left p-3 label">Telefone</th>
              <th className="text-left p-3 label">Nome</th>
              <th className="text-left p-3 label">Status</th>
              <th className="text-left p-3 label">Quando</th>
              <th className="text-left p-3 label">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-3 font-mono text-xs">{maskPhone(r.phone)}</td>
                <td className="p-3">{r.name ?? "—"}</td>
                <td className="p-3">
                  <RecipientBadge status={r.status} />
                </td>
                <td className="p-3 text-xs text-gray2">
                  {r.sent_at && `Enviada ${relativeTime(r.sent_at)}`}
                  {r.failed_at && !r.sent_at && `Falhou ${relativeTime(r.failed_at)}`}
                  {r.read_at && ` • Lida ${relativeTime(r.read_at)}`}
                </td>
                <td className="p-3 text-xs text-red-300/80">{r.failed_reason ?? ""}</td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray2 text-sm">
                {c.status === "draft" ? "Clique em \"Iniciar\" pra materializar destinatários" : "Sem destinatários"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusVariant(status: string) {
  return ({
    draft: "default", scheduled: "pending", running: "active",
    paused: "paused", completed: "resolved", canceled: "closed", failed: "closed",
  } as any)[status] ?? "default";
}

function RecipientBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    pending: { v: "default", t: "pendente" },
    queued:  { v: "pending", t: "na fila" },
    sending: { v: "active",  t: "enviando" },
    sent:    { v: "resolved", t: "enviada" },
    delivered:{ v: "resolved", t: "entregue" },
    read:    { v: "resolved", t: "lida" },
    failed:  { v: "closed",  t: "falha" },
    skipped: { v: "closed",  t: "pulada" },
    opted_out: { v: "paused", t: "opt-out" },
  };
  const m = map[status] ?? { v: "default", t: status };
  return <Badge variant={m.v}>{m.t}</Badge>;
}

function Kpi({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon?: any }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray2">{label}</p>
      <p className={`font-display font-extrabold text-2xl ${color} mt-1 flex items-center justify-center gap-1`}>
        {Icon && <Icon size={16} />} {value}
      </p>
    </div>
  );
}
