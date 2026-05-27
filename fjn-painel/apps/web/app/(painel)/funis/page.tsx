"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Kanban, Plus, Star, Briefcase, MessageSquare, Headphones, Heart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const iconMap: Record<string, any> = {
  briefcase: Briefcase,
  message: MessageSquare,
  headphones: Headphones,
  heart: Heart,
};

interface Pipeline {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_default: boolean;
  stages_count: number;
  open_cards_count: number;
}

export default function FunisPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#FFBA00");

  const { data: pipelines = [], isLoading } = useQuery<Pipeline[]>({
    queryKey: ["pipelines"],
    queryFn: async () => (await api.get("/pipelines")).data.items,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/pipelines", { name: newName, color: newColor });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      setShowCreate(false);
      setNewName("");
      toast.success("Funil criado!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao criar funil"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/pipelines/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Funil arquivado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Kanban className="text-orange" />
            Funis de atendimento
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Organize conversas em pipelines com etapas customizadas
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Novo funil
        </button>
      </div>

      {/* Card de criação */}
      {showCreate && (
        <div className="card p-5 border-orange/40">
          <h3 className="font-display font-bold text-lg mb-4">Criar novo funil</h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
            <div>
              <label className="label block mb-1">Nome</label>
              <input className="input w-full" placeholder="Ex: Comercial / Suporte"
                     value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">Cor</label>
              <input type="color" className="h-10 w-20 rounded cursor-pointer bg-transparent border border-border"
                     value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
            <button onClick={() => createMut.mutate()}
                    disabled={!newName || createMut.isPending}
                    className="btn-primary">
              {createMut.isPending ? "Criando..." : "Criar funil"}
            </button>
          </div>
          <p className="text-xs text-gray2 mt-3">
            Etapas padrão serão criadas: Novo → Qualificando → Proposta → Negociação → Ganho / Perdido.
            Você pode editar depois.
          </p>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray2 text-sm">Carregando funis...</p>
      ) : pipelines.length === 0 ? (
        <div className="card p-12 text-center">
          <Kanban size={48} className="text-gray2 mx-auto mb-4" />
          <p className="text-light/70">Nenhum funil ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((p) => {
            const Icon = iconMap[p.icon] ?? Briefcase;
            return (
              <div key={p.id} className="card p-5 hover:border-orange/40 transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: p.color + "20" }}>
                      <Icon size={20} style={{ color: p.color }} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-light text-lg flex items-center gap-2">
                        {p.name}
                        {p.is_default && (
                          <Star size={12} className="text-orange fill-orange" />
                        )}
                      </h3>
                      {p.description && (
                        <p className="text-xs text-gray2 mt-0.5">{p.description}</p>
                      )}
                    </div>
                  </div>
                  {!p.is_default && (
                    <button
                      onClick={() => {
                        if (confirm(`Arquivar funil "${p.name}"?`)) deleteMut.mutate(p.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray2 hover:text-red-400"
                      title="Arquivar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray2 mb-4">
                  <span>{p.stages_count} etapas</span>
                  <span>·</span>
                  <span>{p.open_cards_count} cards abertos</span>
                </div>

                <Link href={`/funis/${p.id}`}
                      className="block w-full text-center btn-ghost text-sm">
                  Abrir Kanban →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4 bg-navy4/30 border-border">
        <p className="text-xs text-light/80">
          💡 <strong>Dica:</strong> A <span className="text-orange">estrela</span> indica o funil padrão —
          toda nova conversa do WhatsApp entra automaticamente nele.
        </p>
      </div>
    </div>
  );
}
