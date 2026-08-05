"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth";

interface RealtimeMsg {
  channel: "new_handoff" | "new_message" | "hello";
  payload: any;
}

export function useRealtime() {
  const qc = useQueryClient();
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  // Pede permissão pra notificações desktop no primeiro login
  useEffect(() => {
    if (!token) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Delay pequeno pra não pedir na hora exata do load
      setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
    const wsUrl = base.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;

    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimeout.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => {/* será tratado pelo onclose */};

      ws.onmessage = (e) => {
        try {
          const msg: RealtimeMsg = JSON.parse(e.data);
          if (msg.channel === "new_handoff") {
            qc.invalidateQueries({ queryKey: ["handoffs"] });
            qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
            toast(`🔔 Novo handoff: ${msg.payload.reason}`, {
              duration: 6000,
              style: { background: "#FFBA00", color: "#060C28", fontWeight: 700 },
            });
            playPing();
            desktopNotify(
              "🔔 Novo handoff — FJN Atende",
              msg.payload.reason ?? "Cliente pediu humano",
              "/handoffs",
            );
          } else if (msg.channel === "new_message") {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            qc.invalidateQueries({ queryKey: ["thread", msg.payload.conversation_id] });
            qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
            // Notifica só se aba não estiver focada (evita spam pro atendente ativo)
            if (typeof document !== "undefined" && document.hidden) {
              desktopNotify(
                `💬 Nova mensagem — ${msg.payload.contact_name ?? msg.payload.contact_phone ?? "cliente"}`,
                (msg.payload.preview ?? msg.payload.content ?? "").slice(0, 100),
                `/conversas?id=${msg.payload.conversation_id}`,
              );
            }
          }
        } catch {}
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [token, qc]);

  return { connected };
}

/**
 * Dispara notificação desktop se browser suporta + usuário aprovou.
 * Ao clicar, foca aba e navega pra URL.
 */
function desktopNotify(title: string, body: string, url?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: url ?? "fjn-atende",  // agrupa notificações do mesmo tipo
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      if (url) window.location.href = url;
      n.close();
    };
    // Auto-close depois de 10s
    setTimeout(() => n.close(), 10_000);
  } catch {
    // ignora se der erro (browser antigo, etc)
  }
}

let audioCtx: AudioContext | null = null;
function playPing() {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    o.start();
    o.stop(audioCtx.currentTime + 0.4);
  } catch {}
}
