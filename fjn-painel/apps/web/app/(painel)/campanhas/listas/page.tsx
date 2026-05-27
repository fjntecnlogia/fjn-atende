"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Plus, Users, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";

export default function ListasPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: lists = [] } = useQuery<any[]>({
    queryKey: ["contact-lists"],
    queryFn: async () => (await api.get("/contact-lists")).data,
    refetchInterval: 10_000,
  });

  async function createList() {
    if (!newName.trim()) return;
    try {
      await api.post("/contact-lists", { name: newName, description: newDesc || undefined });
      toast.success("Lista criada");
      setNewName(""); setNewDesc(""); setShowNew(false);
      qc.invalidateQueries({ queryKey: ["contact-lists"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  async function deleteList(id: number, name: string) {
    if (!confirm(`Apagar lista "${name}"? Todos os contatos serão removidos.`)) return;
    try {
      await api.delete(`/contact-lists/${id}`);
      toast.success("Lista apagada");
      qc.invalidateQueries({ queryKey: ["contact-lists"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/campanhas" className="text-xs text-gray2 hover:text-orange">← Campanhas</Link>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3 mt-1">
            <FolderOpen className="text-orange" />
            Listas de contatos
          </h1>
          <p className="text-sm text-gray2 mt-1">Organize destinatários por segmento ou origem</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Nova lista
        </button>
      </div>

      {/* Modal nova lista */}
      {showNew && (
        <div className="card p-5 border-orange/30 bg-orange/5">
          <h3 className="font-display font-bold mb-3">Nova lista</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input className="input w-full mt-1" placeholder="Ex: Clientes ativos"
                     value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Descrição</label>
              <input className="input w-full mt-1" placeholder="Opcional"
                     value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="btn-ghost">Cancelar</button>
              <button onClick={createList} className="btn-primary">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de listas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lists.map((l) => (
          <Link key={l.id} href={`/campanhas/listas/${l.id}`}
                className="card p-5 hover:border-orange/40 transition-colors group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-light truncate">{l.name}</h3>
                {l.description && (
                  <p className="text-xs text-gray2 mt-1 line-clamp-2">{l.description}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteList(l.id, l.name); }}
                className="opacity-0 group-hover:opacity-100 text-gray2 hover:text-red-400 transition-all p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
              <Stat label="Total" value={l.total_count} color="text-light" />
              <Stat label="Opt-in" value={l.optin_count} color="text-green-400" />
              <Stat label="Opt-out" value={l.optout_count} color="text-orange" />
            </div>

            <p className="text-[10px] text-gray2 mt-3">
              Criada {relativeTime(l.created_at)} {l.source && `• ${l.source}`}
            </p>
          </Link>
        ))}
        {lists.length === 0 && !showNew && (
          <div className="col-span-full card p-12 text-center">
            <Users className="mx-auto mb-3 text-gray2/50" size={32} />
            <p className="text-gray2 text-sm">Nenhuma lista ainda</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={14} /> Criar primeira lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-widest text-gray2">{label}</p>
      <p className={`font-display font-extrabold text-lg ${color}`}>{value}</p>
    </div>
  );
}
