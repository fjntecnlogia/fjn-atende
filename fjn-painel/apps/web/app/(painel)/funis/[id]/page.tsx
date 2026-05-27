"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Trophy, XCircle, Clock, User, Tag, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Stage {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  win_probability: number;
}

interface Card {
  id: number;
  conversation_id: number;
  pipeline_id: number;
  stage_id: number;
  contact_name: string | null;
  contact_phone: string;
  value_cents: number;
  tags: string[];
  hours_in_stage: number;
  assigned_user_name: string | null;
  assigned_team_name: string | null;
  last_message_at: string;
}

function money(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function shortHours(h: number): string {
  if (h < 1) return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// =====================================================================
// Card Component (draggable)
// =====================================================================
function CardItem({ card, won, lost }: { card: Card; won?: boolean; lost?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: "card", card },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      className="bg-navy3 border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-orange/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-light text-sm font-semibold truncate">
            {card.contact_name || "Sem nome"}
          </p>
          <p className="text-xs text-gray2 truncate">{card.contact_phone}</p>
        </div>
        {won && <Trophy size={14} className="text-green-400 flex-shrink-0" />}
        {lost && <XCircle size={14} className="text-red-400 flex-shrink-0" />}
      </div>

      {card.value_cents > 0 && (
        <p className="text-orange font-bold text-sm font-display mb-2">
          {money(card.value_cents)}
        </p>
      )}

      {card.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] bg-navy4 text-light/70 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-gray2">
        <div className="flex items-center gap-1">
          {card.assigned_user_name ? (
            <>
              <User size={10} />
              <span className="truncate max-w-[80px]">{card.assigned_user_name.split(" ")[0]}</span>
            </>
          ) : (
            <span className="italic">não atribuído</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{shortHours(card.hours_in_stage)}</span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Column (droppable + sortable list)
// =====================================================================
function Column({ stage, cards }: { stage: Stage; cards: Card[] }) {
  const totalValue = cards.reduce((acc, c) => acc + c.value_cents, 0);

  return (
    <div className="bg-navy2/40 rounded-xl flex flex-col min-w-[280px] max-w-[280px] h-full">
      <div className="px-4 py-3 border-b border-border" style={{ borderBottomColor: stage.color + "60" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <h3 className="font-display font-bold text-light text-sm uppercase tracking-wide truncate">
              {stage.name}
            </h3>
          </div>
          <span className="text-xs bg-navy4 text-light/70 px-2 py-0.5 rounded-full flex-shrink-0">
            {cards.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-gray2 font-display">{money(totalValue)}</p>
        )}
      </div>

      <SortableContext
        items={cards.map((c) => `card-${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2 space-y-2" data-stage-id={stage.id} id={`stage-${stage.id}`}>
          {cards.length === 0 ? (
            <p className="text-center text-xs text-gray2/60 py-8 italic">Nenhum card</p>
          ) : (
            cards.map((card) => (
              <CardItem key={card.id} card={card} won={stage.is_won} lost={stage.is_lost} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// =====================================================================
// Página principal — Kanban
// =====================================================================
export default function KanbanPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = Number(params.id);
  const qc = useQueryClient();
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const { data: pipeline } = useQuery<any>({
    queryKey: ["pipeline", pipelineId],
    queryFn: async () => (await api.get(`/pipelines/${pipelineId}`)).data,
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards", pipelineId],
    queryFn: async () => (await api.get(`/cards?pipeline_id=${pipelineId}&limit=500`)).data.items,
    refetchInterval: 10_000,
  });

  const moveMut = useMutation({
    mutationFn: async ({ cardId, stageId }: { cardId: number; stageId: number }) => {
      await api.post(`/cards/${cardId}/move`, { stage_id: stageId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards", pipelineId] }),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao mover"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Agrupa cards por stage
  const cardsByStage = useMemo(() => {
    const m: Record<number, Card[]> = {};
    for (const c of cards) {
      if (!m[c.stage_id]) m[c.stage_id] = [];
      m[c.stage_id].push(c);
    }
    return m;
  }, [cards]);

  const stages: Stage[] = pipeline?.stages ?? [];

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    if (data?.type === "card") setActiveCard(data.card);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    const card = active.data.current?.card as Card | undefined;
    if (!card) return;

    // Identifica stage de destino
    // over.id pode ser "card-X" (dropou em cima de outro card) ou "stage-X" (dropou na coluna)
    let targetStageId: number | null = null;

    if (String(over.id).startsWith("stage-")) {
      targetStageId = Number(String(over.id).replace("stage-", ""));
    } else {
      const overCard = over.data.current?.card as Card | undefined;
      if (overCard) targetStageId = overCard.stage_id;
    }

    if (!targetStageId || targetStageId === card.stage_id) return;

    // Otimista: atualiza UI antes do servidor
    qc.setQueryData(["cards", pipelineId], (old: Card[] = []) =>
      old.map((c) => (c.id === card.id ? { ...c, stage_id: targetStageId! } : c))
    );
    moveMut.mutate({ cardId: card.id, stageId: targetStageId });
  }

  if (!pipeline) {
    return <div className="p-8 text-gray2">Carregando funil...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-8 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/funis")} className="text-gray2 hover:text-light">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-light flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pipeline.color }} />
              {pipeline.name}
            </h1>
            <p className="text-xs text-gray2">
              {stages.length} etapas · {cards.length} cards
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm">Filtros</button>
          <button className="btn-ghost text-sm">Métricas</button>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full">
            {stages.map((stage) => (
              <Column
                key={stage.id}
                stage={stage}
                cards={cardsByStage[stage.id] ?? []}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="bg-navy3 border border-orange rounded-lg p-3 shadow-2xl rotate-3 opacity-90">
              <p className="text-light text-sm font-semibold">
                {activeCard.contact_name || "Sem nome"}
              </p>
              <p className="text-xs text-gray2">{activeCard.contact_phone}</p>
              {activeCard.value_cents > 0 && (
                <p className="text-orange font-bold text-sm mt-1">
                  {money(activeCard.value_cents)}
                </p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
