"use client";

import { cn, maskPhone, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Conversation } from "@fjn-painel/shared";

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray2 text-sm p-8 text-center">
        Nenhuma conversa encontrada
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((c) => {
        const selected = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full text-left p-4 border-b border-border/40 transition-colors",
              selected ? "bg-orange/5 border-l-4 border-l-orange" : "hover:bg-white/3",
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-light text-sm truncate">
                  {c.contact_name ?? maskPhone(c.contact_phone)}
                </p>
                <p className="text-xs text-gray2">
                  {c.contact_name ? maskPhone(c.contact_phone) : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-gray2">{relativeTime(c.last_message_at)}</span>
                {(c.unread_count ?? 0) > 0 && (
                  <span className="bg-orange text-navy2 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                    {c.unread_count}
                  </span>
                )}
              </div>
            </div>

            {c.last_message_preview && (
              <p className="text-xs text-light/60 truncate">{c.last_message_preview}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant={c.status as any}>{c.status}</Badge>
              {c.product_detected && (
                <Badge>{c.product_detected}</Badge>
              )}
              {c.assigned_to && (
                <span className="text-[10px] text-gray2 truncate">
                  → {c.assigned_to.split("@")[0]}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
