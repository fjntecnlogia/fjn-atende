import { Client } from "pg";
import { config } from "../config";
import type { WebSocket } from "@fastify/websocket";

const sockets = new Set<WebSocket>();

let listener: Client | null = null;

export async function startRealtime() {
  listener = new Client({ connectionString: config.DATABASE_URL });
  await listener.connect();
  await listener.query("LISTEN new_handoff");
  await listener.query("LISTEN new_message");

  listener.on("notification", (msg) => {
    if (!msg.channel || !msg.payload) return;
    broadcast({ channel: msg.channel, payload: JSON.parse(msg.payload) });
  });

  listener.on("error", (err) => {
    console.error("LISTEN error:", err);
  });

  console.log("📡 Realtime LISTEN ativo: new_handoff, new_message");
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
  await listener?.end();
  for (const ws of sockets) try { ws.close(); } catch {}
  sockets.clear();
}
