"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Crown, Shuffle, Hand, Activity, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { PageIntro } from "@/components/layout/PageIntro";

interface Team {
  id: number;
  name: string;
  description?: string;
  color: string;
  assignment_strategy: "manual" | "round_robin" | "least_busy";
  members_count: number;
  open_cards: number;
}

interface Member {
  user_id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  is_lead: boolean;
  available: boolean;
}

const strategyIcons = {
  manual: Hand,
  round_robin: Shuffle,
  least_busy: Activity,
};

const strategyLabels = {
  manual: "Manual",
  round_robin: "Round-Robin",
  least_busy: "Menos ocupado",
};

export default function TimesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStrategy, setNewStrategy] = useState<"manual" | "round_robin" | "least_busy">("manual");
  const [newColor, setNewColor] = useState("#1A2358");
  const [openTeamId, setOpenTeamId] = useState<number | null>(null);

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => (await api.get("/teams")).data.items,
  });

  const { data: openTeam } = useQuery<any>({
    queryKey: ["team", openTeamId],
    queryFn: async () => openTeamId ? (await api.get(`/teams/${openTeamId}`)).data : null,
    enabled: !!openTeamId,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["tenant-users"],
    queryFn: async () => (await api.get("/tenants/users")).data?.items ?? [],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/teams", { name: newName, assignment_strategy: newStrategy, color: newColor });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setShowCreate(false);
      setNewName("");
      toast.success("Time criado!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/teams/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Time arquivado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const addMemberMut = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await api.post(`/teams/${teamId}/members`, { user_id: userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", openTeamId] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Membro adicionado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const removeMemberMut = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", openTeamId] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Membro removido");
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Users className="text-orange" />
            Times de atendimento
          </h1>
          <p className="text-sm text-gray2 mt-1">
            Organize seus atendentes em equipes com distribuição automática
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Novo time
        </button>
      </div>

      <PageIntro
        storageKey="times-intro"
        title="Como funcionam os Times"
        description="Times agrupam atendentes e definem como as conversas são distribuídas. Útil quando você tem mais de 1 pessoa atendendo."
        steps={[
          "Cria um time (ex: Comercial, Suporte) e adiciona os usuários",
          "Escolhe estratégia: Manual (atendente pega) | Round-robin (revezamento) | Menos ocupado",
          "Conversas novas são distribuídas automaticamente entre membros disponíveis",
          "Cada atendente vê só as conversas atribuídas a ele ou ao seu time",
        ]}
        helpArticle={{ slug: "times-atendimento", label: "Guia de Times e Round-Robin" }}
      />

      {/* Criar */}
      {showCreate && (
        <div className="card p-5 border-orange/40">
          <h3 className="font-display font-bold text-lg mb-4">Criar novo time</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="label block mb-1">Nome</label>
              <input className="input w-full" placeholder="Ex: Comercial"
                     value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">Cor</label>
              <input type="color" className="h-10 w-full rounded cursor-pointer bg-transparent border border-border"
                     value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <label className="label block mb-2">Estratégia de distribuição</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(["manual", "round_robin", "least_busy"] as const).map((s) => {
                const Icon = strategyIcons[s];
                return (
                  <button key={s}
                          onClick={() => setNewStrategy(s)}
                          type="button"
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            newStrategy === s
                              ? "border-orange bg-orange/10"
                              : "border-border hover:border-orange/40"
                          }`}>
                    <Icon size={16} className="text-orange mb-2" />
                    <p className="font-bold text-sm text-light">{strategyLabels[s]}</p>
                    <p className="text-[10px] text-gray2 mt-1">
                      {s === "manual" && "Atendente pega manualmente"}
                      {s === "round_robin" && "Distribui equilibrado entre todos"}
                      {s === "least_busy" && "Vai pra quem tem menos cards abertos"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
            <button onClick={() => createMut.mutate()}
                    disabled={!newName || createMut.isPending}
                    className="btn-primary">
              {createMut.isPending ? "Criando..." : "Criar time"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {teams.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={48} className="text-gray2 mx-auto mb-4" />
          <p className="text-light/70">Nenhum time ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((t) => {
            const StrategyIcon = strategyIcons[t.assignment_strategy];
            return (
              <div key={t.id}
                   className="card p-5 hover:border-orange/40 transition-colors cursor-pointer group"
                   onClick={() => setOpenTeamId(openTeamId === t.id ? null : t.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: t.color + "20" }}>
                      <Users size={20} style={{ color: t.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-light text-lg truncate">{t.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray2 mt-1">
                        <StrategyIcon size={11} />
                        <span>{strategyLabels[t.assignment_strategy]}</span>
                        <span>·</span>
                        <span>{t.members_count} membros</span>
                        <span>·</span>
                        <span>{t.open_cards} cards</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Arquivar time "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray2 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Painel expandido */}
                {openTeamId === t.id && openTeam && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <p className="text-xs text-gray2 uppercase tracking-widest font-bold mb-2">
                        Membros ({openTeam.members?.length ?? 0})
                      </p>
                      {(openTeam.members ?? []).length === 0 ? (
                        <p className="text-xs text-gray2/60 italic">Nenhum membro ainda</p>
                      ) : (
                        <div className="space-y-1">
                          {(openTeam.members as Member[]).map((m) => (
                            <div key={m.user_id} className="flex items-center justify-between bg-navy3 p-2 rounded">
                              <div className="flex items-center gap-2 min-w-0">
                                {m.is_lead && <Crown size={12} className="text-orange flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-sm text-light truncate">{m.name}</p>
                                  <p className="text-[10px] text-gray2 truncate">{m.email}</p>
                                </div>
                              </div>
                              <button onClick={() => removeMemberMut.mutate({ teamId: t.id, userId: m.user_id })}
                                      className="text-gray2 hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray2 uppercase tracking-widest font-bold mb-2">
                        Adicionar membro
                      </p>
                      <select
                        className="input w-full text-sm"
                        onChange={(e) => {
                          const userId = Number(e.target.value);
                          if (userId) addMemberMut.mutate({ teamId: t.id, userId });
                          e.target.value = "";
                        }}>
                        <option value="">Selecionar usuário…</option>
                        {users
                          .filter((u: any) => !openTeam.members?.some((m: any) => m.user_id === u.id))
                          .map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
