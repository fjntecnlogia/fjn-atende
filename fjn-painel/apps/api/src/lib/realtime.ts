import { Client } from "pg";
import { config } from "../config";
import type { WebSocket } from "@fastify/websocket";

const sockets = new Set<WebSocket>();

let listener: Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopped = false;

/**
 * Retorna a URL "direta" (não-pooled) do Postgres.
 * Necessária pra LISTEN/NOTIFY, que exige conexão persistente.
 * Pooled URLs do Neon não suportam LISTEN.
 */
function getDirectUrl(): string {
  if (config.DATABASE_URL_DIRECT) return config.DATABASE_URL_DIRECT;
  // Tenta remover o sufixo "-pooler" se presente (Neon)
  return config.DATABASE_URL.replace(/-pooler(\.[^.]+\.neon\.tech)/, "$1");
}

async function connectListener(): Promise<void> {
  if (stopped) return;
  try {
    listener = new Client({ connectionString: getDirectUrl() });
    await listener.connect();
    await listener.query("LISTEN new_handoff");
    await listener.query("LISTEN new_message");

    listener.on("notification", (msg) => {
      if (!msg.channel || !msg.payload) return;
      try {
        broadcast({ channel: msg.channel, payload: JSON.parse(msg.payload) });
      } catch (err) {
        console.error("Erro broadcast:", err);
      }
    });

    listener.on("error", (err: Error) => {
      console.warn("⚠️ LISTEN conexão caiu:", err.message);
      scheduleReconnect();
    });

    listener.on("end", () => {
      if (!stopped) {
        console.warn("⚠️ LISTEN encerrou — reconectando...");
        scheduleReconnect();
      }
    });

    console.log("📡 Realtime LISTEN ativo: new_handoff, new_message");
  } catch (err: any) {
    console.warn("⚠️ Falha ao conectar LISTEN:", err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (stopped) return;
  if (reconnectTimer) return;
  // Cleanup do cliente anterior
  if (listener) {
    try { listener.removeAllListeners(); listener.end().catch(() => {}); } catch {}
    listener = null;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectListener();
  }, 5_000);
}

export async function startRealtime() {
  stopped = false;
  await connectListener();
}

export function registerSocket(ws: WebSocket) {
  sockets.add(ws);
  ws.on("close", () => sockets.delete(ws));
}

function broadcast(msg: unknown) {
  const data = JSON.stringify(msg);
  for (const ws of sockets) {
    try {
      ws.send(data);
    } catch {
      sockets.delete(ws);
    }
  }
}

export async function stopRealtime() {
  stopped = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  await listener?.end();
  for (const ws of sockets) try { ws.close(); } catch {}
  sockets.clear();
}
