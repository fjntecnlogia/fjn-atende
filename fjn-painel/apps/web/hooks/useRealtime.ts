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
          } else if (msg.channel === "new_message") {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            qc.invalidateQueries({ queryKey: ["thread", msg.payload.conversation_id] });
            qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
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
