"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, FolderOpen, FileText, Plus, Play, Pause, CheckCircle2, XCircle, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/utils";

const statusBadge: Record<string, { label: string; variant: any }> = {
  draft:      { label: "Rascunho",   variant: "default" },
  scheduled:  { label: "Agendada",   variant: "pending" },
  running:    { label: "Enviando",   variant: "active" },
  paused:     { label: "Pausada",    variant: "paused" },
  completed:  { label: "Concluída",  variant: "resolved" },
  canceled:   { label: "Cancelada",  variant: "closed" },
  failed:     { label: "Falhou",     variant: "closed" },
};

export default function CampanhasPage() {
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["campaigns"],
    queryFn: async () => (await api.get("/campaigns")).data,
    refetchInterval: 5_000,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Megaphone className="text-orange" />
            Campanhas
          </h1>
          <p className="text-sm text-gray2 mt-1">Disparo em massa via WhatsApp Business</p>
        </div>
        <div className="flex gap-2">
          <Link href="/campanhas/listas" className="btn-ghost flex items-center gap-2">
            <FolderOpen size={14} /> Listas
          </Link>
          <Link href="/campanhas/templates" className="btn-ghost flex items-center gap-2">
            <FileText size={14} /> Templates
          </Link>
          <Link href="/campanhas/optouts" className="btn-ghost flex items-center gap-2">
            <Ban size={14} /> Opt-outs
          </Link>
          <Link href="/campanhas/nova" className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Nova campanha
          </Link>
        </div>
      </div>

      {/* Alerta sobre uso responsável */}
      <div className="card p-4 bg-orange/5 border-orange/30">
        <p className="text-xs text-light/90">
          ⚠️ <strong>Uso responsável:</strong> dispare apenas para contatos que <em>autorizaram</em> receber suas mensagens.
          O WhatsApp pode banir números que enviam SPAM. Use rate-limit (10/min) e respeite opt-outs.
        </p>
      </div>

      {/* Lista de campanhas */}
      <div className="space-y-3">
        {campaigns.map((c) => {
          const status = statusBadge[c.status] ?? statusBadge.draft;
          const progress = c.total_count > 0
            ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100)
            : 0;
          return (
            <Link
              key={c.id}
              href={`/campanhas/${c.id}`}
              className="card p-5 hover:border-orange/40 transition-colors block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-display font-bold text-light text-lg">{c.name}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Badge>{c.provider}</Badge>
                  </div>
                  <p className="text-xs text-gray2">
                    Criada {relativeTime(c.created_at)}
                    {c.started_at && ` • iniciada ${relativeTime(c.started_at)}`}
                    {c.completed_at && ` • concluída ${relativeTime(c.completed_at)}`}
                  </p>

                  {/* Barra de progresso */}
                  {c.total_count > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray2 mb-1">
                        <span>{c.sent_count + c.failed_count} / {c.total_count}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-navy4 rounded-full overflow-hidden">
                        <div className="h-full bg-orange transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-3 text-center shrink-0 min-w-[280px]">
                  <Stat label="Total" value={c.total_count} color="text-light" />
                  <Stat label="Enviadas" value={c.sent_count} color="text-green-400" icon={CheckCircle2} />
                  <Stat label="Falhas" value={c.failed_count} color="text-red-400" icon={XCircle} />
                  <Stat label="Opt-out" value={c.opted_out_count} color="text-orange" />
                </div>
              </div>
            </Link>
          );
        })}
        {campaigns.length === 0 && (
          <div className="card p-12 text-center">
            <Megaphone className="mx-auto mb-3 text-gray2/50" size={32} />
            <p className="text-gray2 text-sm">Nenhuma campanha criada ainda</p>
            <Link href="/campanhas/nova" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={14} /> Criar primeira campanha
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label, value, color, icon: Icon,
}: { label: string; value: number; color: string; icon?: any }) {
  return (
    <div>
      <p className="label text-[9px]">{label}</p>
      <p className={`font-display font-extrabold text-xl ${color} flex items-center justify-center gap-1`}>
        {Icon && <Icon size={14} />}
        {value}
      </p>
    </div>
  );
}
