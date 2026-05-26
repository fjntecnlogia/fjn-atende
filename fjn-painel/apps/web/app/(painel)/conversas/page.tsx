"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Conversation } from "@fjn-painel/shared";
import { ConversationList } from "./_components/ConversationList";
import { ConversationThread } from "./_components/ConversationThread";

export default function ConversasPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");

  const { data: conversations = [], refetch } = useQuery<Conversation[]>({
    queryKey: ["conversations", { search, status }],
    queryFn: async () =>
      (await api.get("/conversations", { params: { search, status } })).data,
    refetchInterval: 10_000,
  });

  return (
    <div className="flex h-screen">
      {/* Coluna esquerda: lista */}
      <div className="w-[380px] border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-display font-bold text-lg mb-3">Conversas</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray2" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Buscar nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 mt-3 text-xs">
            {(["all", "active", "paused"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  status === s
                    ? "px-3 py-1 rounded-full bg-orange text-navy2 font-bold"
                    : "px-3 py-1 rounded-full text-gray2 hover:text-light"
                }
              >
                {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Pausadas"}
              </button>
            ))}
          </div>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Coluna direita: thread */}
      <div className="flex-1 overflow-hidden">
        {selectedId ? (
          <ConversationThread conversationId={selectedId} onChanged={refetch} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray2">
            <p className="text-sm">Selecione uma conversa à esquerda</p>
          </div>
        )}
      </div>
    </div>
  );
}
