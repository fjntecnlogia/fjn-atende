"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Send, StickyNote, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";

interface Msg {
  id: number;
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
  sent_at: string;
}

interface Note {
  id: number;
  body: string;
  created_at: string;
  author: string | null;
}

export function ConversationThread({
  conversationId,
  onChanged,
}: {
  conversationId: number;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<Msg[]>({
    queryKey: ["thread", conversationId],
    queryFn: async () =>
      (await api.get(`/conversations/${conversationId}/messages`)).data,
    refetchInterval: 5_000,
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery<Note[]>({
    queryKey: ["notes", conversationId],
    queryFn: async () => (await api.get(`/conversations/${conversationId}/notes`)).data,
    enabled: showNotes,
  });

  useEffect(() => {
    // Marca como lida
    api.post(`/conversations/${conversationId}/read`).catch(() => {});
    onChanged();
  }, [conversationId, onChanged]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/conversations/${conversationId}/send`, { content: draft });
      setDraft("");
      toast.success("Mensagem enviada — bot pausado por 60 min");
      await qc.invalidateQueries({ queryKey: ["thread", conversationId] });
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function pause() {
    await api.post(`/conversations/${conversationId}/pause`, { minutes: 0 });
    toast.success("Bot pausado");
    onChanged();
  }

  async function resume() {
    await api.post(`/conversations/${conversationId}/resume`);
    toast.success("Bot reativado");
    onChanged();
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    await api.post(`/conversations/${conversationId}/notes`, { body: noteDraft });
    setNoteDraft("");
    refetchNotes();
    toast.success("Nota adicionada");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-navy3/30">
        <h3 className="font-display font-bold">Conversa #{conversationId}</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowNotes((v) => !v)} className="btn-ghost flex items-center gap-1">
            <StickyNote size={14} /> Notas
          </button>
          <button onClick={pause} className="btn-ghost flex items-center gap-1">
            <Pause size={14} /> Pausar bot
          </button>
          <button onClick={resume} className="btn-ghost flex items-center gap-1">
            <Play size={14} /> Reativar bot
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {messages.length === 0 && (
            <p className="text-center text-gray2 text-sm py-8">Sem mensagens ainda</p>
          )}
        </div>

        {/* Painel lateral de notas */}
        {showNotes && (
          <div className="w-[300px] border-l border-border bg-navy2/40 flex flex-col">
            <div className="p-3 border-b border-border">
              <p className="label">Notas internas</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="card p-2.5">
                  <p className="text-xs text-light/90 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[10px] text-gray2 mt-1.5">
                    {n.author ?? "—"} • {relativeTime(n.created_at)}
                  </p>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-gray2 text-center py-4">Sem notas</p>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <textarea
                className="input w-full text-sm resize-none"
                rows={3}
                placeholder="Adicionar nota interna..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <button onClick={addNote} className="btn-primary w-full mt-2 text-sm py-1.5">
                Salvar nota
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-4 bg-navy2/50">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            className="input flex-1 resize-none"
            rows={2}
            placeholder="Mensagem manual (Ctrl/Cmd+Enter para enviar — pausa o bot)..."
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="btn-primary flex items-center gap-2 self-end"
          >
            <Send size={14} />
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
        <p className="text-[10px] text-gray2 mt-1.5">
          <UserCheck size={10} className="inline mr-1" />
          Enviar mensagem assume a conversa e pausa a IA por 60 minutos
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const isHuman = msg.role === "human_agent";

  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
          isUser && "bg-navy3 text-light rounded-tl-sm",
          !isUser && !isHuman && "bg-orange/10 border border-orange/30 text-light rounded-tr-sm",
          isHuman && "bg-green-500/15 border border-green-500/30 text-light rounded-tr-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p className="text-[10px] text-light/40 mt-1 flex items-center gap-1">
          {isHuman && "🧑 humano"}
          {!isUser && !isHuman && "🤖 IA"}
          {isUser && "👤 cliente"}
          <span>•</span>
          <span>{relativeTime(msg.sent_at)}</span>
        </p>
      </div>
    </div>
  );
}
