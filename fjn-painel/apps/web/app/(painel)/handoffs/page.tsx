"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { maskPhone, relativeTime } from "@/lib/utils";
import type { Handoff } from "@fjn-painel/shared";

export default function HandoffsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "taken" | "resolved" | "all">("pending");

  const { data: handoffs = [] } = useQuery<Handoff[]>({
    queryKey: ["handoffs", filter],
    queryFn: async () => (await api.get("/handoffs", { params: { status: filter } })).data,
    refetchInterval: 15_000,
  });

  async function take(id: number) {
    await api.post(`/handoffs/${id}/take`);
    toast.success("Você assumiu este handoff");
    qc.invalidateQueries({ queryKey: ["handoffs"] });
  }

  async function resolve(id: number) {
    await api.post(`/handoffs/${id}/resolve`);
    toast.success("Handoff resolvido");
    qc.invalidateQueries({ queryKey: ["handoffs"] });
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <AlertTriangle className="text-orange" />
            Handoffs
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Atendimentos que a IA transferiu para humano
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {(["pending", "taken", "resolved", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                filter === s
                  ? "px-3 py-1.5 rounded-full bg-orange text-navy2 font-bold"
                  : "px-3 py-1.5 rounded-full text-gray2 hover:text-light"
              }
            >
              {s === "pending"
                ? "Pendentes"
                : s === "taken"
                ? "Assumidos"
                : s === "resolved"
                ? "Resolvidos"
                : "Todos"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {handoffs.map((h) => (
          <div key={h.id} className="card p-5 hover:border-orange/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="pending">{h.reason}</Badge>
                  {h.taken_at && !h.resolved_at && <Badge variant="taken">Em andamento</Badge>}
                  {h.resolved_at && <Badge variant="resolved">Resolvido</Badge>}
                  <span className="text-xs text-gray2">{relativeTime(h.notified_at)}</span>
                </div>

                <p className="font-semibold text-light">
                  {h.contact_name ?? "Sem nome"}{" "}
                  <span className="text-gray2 text-xs font-normal">
                    • {maskPhone(h.contact_phone)}
                  </span>
                </p>

                {h.trigger_message && (
                  <div className="mt-3 bg-navy2/60 border border-border rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray2 mb-1">
                      Última mensagem do cliente
                    </p>
                    <p className="text-sm text-light/90 line-clamp-3">{h.trigger_message}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Link
                  href={`/conversas?id=${h.conversation_id}`}
                  className="btn-ghost flex items-center gap-1.5 text-xs"
                >
                  <MessageSquare size={12} /> Abrir
                </Link>
                {!h.taken_at && (
                  <button onClick={() => take(h.id)} className="btn-primary text-xs py-1.5">
                    Assumir
                  </button>
                )}
                {h.taken_at && !h.resolved_at && (
                  <button
                    onClick={() => resolve(h.id)}
                    className="btn-primary text-xs py-1.5 flex items-center gap-1"
                  >
                    <Check size={12} /> Resolver
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {handoffs.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-gray2 text-sm">Nenhum handoff nesta lista</p>
          </div>
        )}
      </div>
    </div>
  );
}
