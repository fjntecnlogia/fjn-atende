"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Kanban, Trophy, XCircle, User, Users, Tag, DollarSign,
  ChevronDown, Edit2, Plus, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Card {
  id: number;
  conversation_id: number;
  pipeline_id: number;
  pipeline_name: string;
  stage_id: number;
  stage_name: string;
  stage_color: string;
  is_won: boolean;
  is_lost: boolean;
  win_probability: number;
  value_cents: number;
  tags: string[];
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_team_id: number | null;
  assigned_team_name: string | null;
  next_action_note: string | null;
  next_action_at: string | null;
  lost_reason: string | null;
}

interface Stage {
  id: number;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
}

interface Pipeline {
  id: number;
  name: string;
  stages: Stage[];
}

function money(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function CardSidebar({ conversationId }: { conversationId: number }) {
  const qc = useQueryClient();
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState("");

  // Lista todos os cards desta conversa (pode estar em N pipelines)
  const { data: cards = [], refetch } = useQuery<Card[]>({
    queryKey: ["conversation-cards", conversationId],
    queryFn: async () => {
      // Filtra cards onde conversation_id = X
      const r = await api.get(`/cards?limit=20`);
      return (r.data.items as Card[]).filter((c) => c.conversation_id === conversationId);
    },
  });

  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["pipelines-full"],
    queryFn: async () => {
      const r = await api.get("/pipelines");
      const list = r.data.items as any[];
      // Carrega stages de cada pipeline em paralelo
      const full = await Promise.all(
        list.map(async (p) => {
          const detail = await api.get(`/pipelines/${p.id}`);
          return detail.data;
        })
      );
      return full;
    },
  });

  const moveMut = useMutation({
    mutationFn: async ({ cardId, stageId }: { cardId: number; stageId: number }) => {
      await api.post(`/cards/${cardId}/move`, { stage_id: stageId });
    },
    onSuccess: () => refetch(),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao mover"),
  });

  const updateValueMut = useMutation({
    mutationFn: async ({ cardId, valueCents }: { cardId: number; valueCents: number }) => {
      await api.put(`/cards/${cardId}`, { value_cents: valueCents });
    },
    onSuccess: () => {
      refetch();
      setEditingValue(false);
      toast.success("Valor atualizado");
    },
  });

  const winMut = useMutation({
    mutationFn: async (cardId: number) => { await api.post(`/cards/${cardId}/win`); },
    onSuccess: () => {
      refetch();
      toast.success("🏆 Marcado como ganho!");
    },
  });

  const loseMut = useMutation({
    mutationFn: async ({ cardId, reason }: { cardId: number; reason: string }) => {
      await api.post(`/cards/${cardId}/lose`, { reason });
    },
    onSuccess: () => {
      refetch();
      toast.success("Marcado como perdido");
    },
  });

  if (cards.length === 0) {
    return (
      <div className="p-4 text-center">
        <Kanban size={32} className="text-gray2 mx-auto mb-2" />
        <p className="text-xs text-gray2">Esta conversa não está em nenhum funil</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const pipeline = pipelines.find((p) => p.id === card.pipeline_id);
        const stages = pipeline?.stages ?? [];

        return (
          <div key={card.id} className="bg-navy3 rounded-lg border border-border p-4 space-y-3">
            {/* Header com pipeline */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Kanban size={14} className="text-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-light/80">
                {card.pipeline_name}
              </span>
              {card.is_won && <Trophy size={14} className="text-green-400 ml-auto" />}
              {card.is_lost && <XCircle size={14} className="text-red-400 ml-auto" />}
            </div>

            {/* Etapa atual + selector */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray2 font-bold mb-1.5">
                Etapa atual
              </label>
              <div className="relative">
                <select
                  value={card.stage_id}
                  onChange={(e) => moveMut.mutate({ cardId: card.id, stageId: Number(e.target.value) })}
                  className="input w-full pr-8 text-sm appearance-none cursor-pointer"
                  style={{ borderLeftWidth: 4, borderLeftColor: card.stage_color }}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_won ? "🏆" : s.is_lost ? "❌" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray2" />
              </div>
              {card.win_probability > 0 && card.win_probability < 100 && (
                <p className="text-[10px] text-gray2 mt-1">
                  Probabilidade de fechar: <strong>{card.win_probability}%</strong>
                </p>
              )}
            </div>

            {/* Valor */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray2 font-bold mb-1.5">
                Valor da oportunidade
              </label>
              {editingValue ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    autoFocus
                    placeholder="0,00"
                    value={valueInput}
                    onChange={(e) => setValueInput(e.target.value)}
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={() => {
                      const cents = Math.round(parseFloat(valueInput.replace(",", ".")) * 100);
                      if (!isNaN(cents) && cents >= 0) {
                        updateValueMut.mutate({ cardId: card.id, valueCents: cents });
                      }
                    }}
                    className="btn-primary px-3 text-xs"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingValue(true);
                    setValueInput((card.value_cents / 100).toFixed(2));
                  }}
                  className="flex items-center gap-2 text-light hover:text-orange transition-colors w-full"
                >
                  <DollarSign size={14} className="text-orange" />
                  <span className="font-display font-bold text-lg">
                    {card.value_cents > 0 ? money(card.value_cents) : "—"}
                  </span>
                  <Edit2 size={11} className="text-gray2 ml-auto" />
                </button>
              )}
            </div>

            {/* Atribuição */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray2 font-bold mb-1.5">
                Atendente
              </label>
              {card.assigned_user_name ? (
                <div className="flex items-center gap-2 text-sm text-light">
                  <div className="w-7 h-7 rounded-full bg-orange/20 flex items-center justify-center">
                    <User size={12} className="text-orange" />
                  </div>
                  <span>{card.assigned_user_name}</span>
                </div>
              ) : card.assigned_team_name ? (
                <div className="flex items-center gap-2 text-sm text-light">
                  <Users size={14} className="text-orange" />
                  <span>Time: {card.assigned_team_name}</span>
                </div>
              ) : (
                <p className="text-xs text-gray2 italic">Não atribuído</p>
              )}
            </div>

            {/* Tags */}
            {card.tags?.length > 0 && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray2 font-bold mb-1.5">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-orange/15 text-orange px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lost reason */}
            {card.is_lost && card.lost_reason && (
              <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-1">
                  Motivo da perda
                </p>
                <p className="text-xs text-light/80">{card.lost_reason}</p>
              </div>
            )}

            {/* Ações */}
            {!card.is_won && !card.is_lost && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => winMut.mutate(card.id)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold transition-colors"
                >
                  <Trophy size={12} /> Ganho
                </button>
                <button
                  onClick={() => {
                    const reason = prompt("Por que perdeu este cliente?");
                    if (reason) loseMut.mutate({ cardId: card.id, reason });
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-colors"
                >
                  <XCircle size={12} /> Perdido
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
