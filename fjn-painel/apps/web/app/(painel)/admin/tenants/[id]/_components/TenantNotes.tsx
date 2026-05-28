"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Pin, PinOff, Trash2, Plus, MessageCircle, AlertTriangle, CreditCard, Briefcase, TrendingDown } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Note {
  id: number;
  tenant_id: number;
  author_id: number | null;
  author_name: string | null;
  author_current_name: string | null;
  body: string;
  category: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  general:     { label: "Geral",       color: "bg-gray2/15 text-gray2 border-gray2/30",   icon: MessageCircle },
  support:     { label: "Suporte",     color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: AlertTriangle },
  billing:     { label: "Billing",     color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CreditCard },
  sales:       { label: "Venda",       color: "bg-orange/15 text-orange border-orange/30", icon: Briefcase },
  churn_risk:  { label: "Risco churn", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: TrendingDown },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function TenantNotes({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const [draftBody, setDraftBody] = useState("");
  const [draftCategory, setDraftCategory] = useState<keyof typeof categoryConfig>("general");
  const [draftPinned, setDraftPinned] = useState(false);

  const { data: notesData } = useQuery<{ items: Note[] }>({
    queryKey: ["tenant-notes", tenantId],
    queryFn: async () => (await api.get(`/admin/tenant-notes/${tenantId}`)).data,
  });

  const createMut = useMutation({
    mutationFn: async () => (await api.post(`/admin/tenant-notes/${tenantId}`, {
      body: draftBody,
      category: draftCategory,
      pinned: draftPinned,
    })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-notes", tenantId] });
      setDraftBody("");
      setDraftCategory("general");
      setDraftPinned(false);
      toast.success("Nota adicionada");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const togglePinMut = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) =>
      (await api.patch(`/admin/tenant-notes/note/${id}`, { pinned })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-notes", tenantId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/admin/tenant-notes/note/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-notes", tenantId] });
      toast.success("Nota apagada");
    },
  });

  const notes = notesData?.items ?? [];

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-display text-xl font-bold flex items-center gap-2">
        <StickyNote className="text-orange" size={18} />
        Notas internas
        <span className="text-xs text-gray2 font-normal">({notes.length})</span>
      </h2>
      <p className="text-xs text-gray2 -mt-3">
        Anotações privadas só pra super-admins (clientes não veem).
      </p>

      {/* Form pra nova nota */}
      <div className="bg-navy3 rounded-lg p-3 space-y-2">
        <textarea
          className="input w-full text-sm resize-none"
          rows={3}
          placeholder="Adicionar uma nota sobre este tenant..."
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input text-xs" value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value as any)}>
            {Object.entries(categoryConfig).map(([k, cfg]) => (
              <option key={k} value={k}>{cfg.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-light/80 cursor-pointer">
            <input type="checkbox" checked={draftPinned}
                   onChange={(e) => setDraftPinned(e.target.checked)}
                   className="accent-orange" />
            <Pin size={12} /> Fixar no topo
          </label>
          <div className="flex-1" />
          <button onClick={() => createMut.mutate()}
                  disabled={!draftBody.trim() || createMut.isPending}
                  className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
            <Plus size={12} />
            {createMut.isPending ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </div>

      {/* Lista de notas */}
      {notes.length === 0 ? (
        <div className="text-center py-8">
          <StickyNote size={28} className="text-gray2 mx-auto mb-2" />
          <p className="text-xs text-gray2">Nenhuma nota ainda</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const cfg = categoryConfig[n.category] ?? categoryConfig.general;
            const Icon = cfg.icon;
            return (
              <li key={n.id}
                  className={`p-3 rounded-lg border ${n.pinned ? "bg-orange/5 border-orange/30" : "bg-navy3 border-border"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                    {n.pinned && (
                      <span className="text-[10px] text-orange flex items-center gap-1">
                        <Pin size={10} /> fixada
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => togglePinMut.mutate({ id: n.id, pinned: !n.pinned })}
                            className="text-gray2 hover:text-orange p-1"
                            title={n.pinned ? "Desafixar" : "Fixar"}>
                      {n.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    <button onClick={() => {
                      if (confirm("Apagar esta nota?")) deleteMut.mutate(n.id);
                    }}
                            className="text-gray2 hover:text-red-400 p-1"
                            title="Apagar">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-light/90 whitespace-pre-wrap break-words">
                  {n.body}
                </p>
                <p className="text-[10px] text-gray2 mt-2">
                  {n.author_current_name ?? n.author_name ?? "—"} · {relativeTime(n.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
