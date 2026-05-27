import type { FastifyInstance } from "fastify";
import { z } from "zod";
import axios from "axios";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";
import { config } from "../../config";

/**
 * Gerenciamento de instâncias WhatsApp (WPP-Connect) por tenant.
 *
 * Cada tenant tem uma ou mais sessões. Cada sessão = 1 número de WhatsApp.
 * Para conectar: cria a sessão → start-session → escaneia QR → connected.
 */

function wppBaseUrl(): string {
  return config.WPPCONNECT_BASE_URL!.replace(/\/$/, "");
}

async function generateToken(sessionName: string): Promise<string> {
  const r = await axios.post(
    `${wppBaseUrl()}/api/${sessionName}/${config.WPPCONNECT_SECRET_KEY}/generate-token`,
    null,
    { timeout: 10_000 },
  );
  const t = r.data?.token ?? r.data?.full?.replace(/^Bearer /, "");
  if (!t) throw new Error("WPP-Connect: falha ao gerar token");
  return t;
}

async function callWpp(sessionName: string, token: string, endpoint: string, data?: any) {
  return axios.post(
    `${wppBaseUrl()}/api/${sessionName}${endpoint}`,
    data ?? {},
    { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 },
  );
}

export async function instancesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Listar instâncias do tenant
  // -----------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT id, session_name, phone_number, status, last_qr_at, last_connected_at, created_at
         FROM whatsapp_instances
        WHERE tenant_id = $1
        ORDER BY id`,
      [req.tenantId!],
    );
    return r.rows;
  });

  // -----------------------------------------------------------------
  // Criar nova instância (1 por padrão, mais conforme plano)
  // -----------------------------------------------------------------
  app.post("/", { preHandler: requireTenant }, async (req, reply) => {
    const tid = req.tenantId!;

    // Verifica limite do plano
    const limitCheck = await db.query(`
      SELECT p.max_instances,
        (SELECT COUNT(*)::int FROM whatsapp_instances WHERE tenant_id = t.id) AS current
        FROM tenants t JOIN plans p ON p.slug = t.plan
       WHERE t.id = $1
    `, [tid]);
    const { max_instances, current } = limitCheck.rows[0];
    if (max_instances > 0 && current >= max_instances) {
      return reply.code(402).send({ error: `limite do plano atingido (${current}/${max_instances})` });
    }

    const tenant = await db.query(`SELECT slug FROM tenants WHERE id = $1`, [tid]);
    const sessionName = `t${tid}-${tenant.rows[0].slug}-${current + 1}`;

    try {
      const token = await generateToken(sessionName);
      const r = await db.query(
        `INSERT INTO whatsapp_instances (tenant_id, session_name, session_token, status)
         VALUES ($1, $2, $3, 'pending') RETURNING *`,
        [tid, sessionName, token],
      );
      return reply.code(201).send(r.rows[0]);
    } catch (err: any) {
      return reply.code(502).send({ error: `falha criando instância: ${err.message}` });
    }
  });

  // -----------------------------------------------------------------
  // Iniciar sessão (gera QR)
  // -----------------------------------------------------------------
  app.post("/:id/start", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT * FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    const inst = r.rows[0];

    try {
      const headers = { Authorization: `Bearer ${inst.session_token}` };

      // 1. Dispara start-session (assíncrono — WPP retorna rápido, ainda CLOSED)
      //    NÃO passamos webhook aqui — WPP usa o WEBHOOK_URL global do .env
      //    (passar `webhook: null` aqui sobrescreve e DESATIVA o webhook!)
      await callWpp(inst.session_name, inst.session_token, "/start-session", {
        waitQrCode: false,
      });

      // 2. Faz polling interno por até 50s pra capturar o QR
      //    (WPP-Connect leva 10-30s pra inicializar Chrome + WA Web)
      let qr: string | null = null;
      let status: string | undefined;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (let attempt = 0; attempt < 25; attempt++) {
        await sleep(2_000);

        // Tenta endpoint dedicado (retorna PNG)
        try {
          const qrResp = await axios.get(
            `${wppBaseUrl()}/api/${inst.session_name}/qrcode-session`,
            { headers, timeout: 6_000, responseType: "arraybuffer" },
          );
          const ct = String(qrResp.headers["content-type"] ?? "");
          if (ct.includes("image") && qrResp.data.length > 100) {
            qr = `data:${ct};base64,${Buffer.from(qrResp.data).toString("base64")}`;
            req.log.info({ attempt, qr_len: qrResp.data.length }, "QR capturado via qrcode-session");
            break;
          }
        } catch { /* segue */ }

        // Tenta status-session (pode trazer qrcode como base64)
        try {
          const statusResp = await axios.get(
            `${wppBaseUrl()}/api/${inst.session_name}/status-session`,
            { headers, timeout: 6_000 },
          );
          status = statusResp.data?.status;
          const maybeQr = statusResp.data?.qrcode ?? statusResp.data?.qr;
          if (maybeQr && maybeQr.length > 100) {
            qr = maybeQr;
            req.log.info({ attempt, status }, "QR capturado via status-session");
            break;
          }
          req.log.debug({ attempt, status }, "aguardando QR...");
          if (status === "CONNECTED" || status === "inChat") break;
        } catch { /* segue */ }
      }

      await db.query(
        `UPDATE whatsapp_instances
            SET status = 'connecting', last_qr = $2, last_qr_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [id, qr],
      );
      return { ok: true, qr, status };
    } catch (err: any) {
      await db.query(
        `UPDATE whatsapp_instances SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [id],
      );
      return reply.code(502).send({ error: `falha iniciando sessão: ${err.message}` });
    }
  });

  // -----------------------------------------------------------------
  // Status atual + QR (poll)
  // -----------------------------------------------------------------
  app.get("/:id/status", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT session_name, session_token FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    const inst = r.rows[0];

    try {
      const headers = { Authorization: `Bearer ${inst.session_token}` };
      // status-session retorna o status + às vezes o qrcode
      const statusResp = await axios.get(
        `${wppBaseUrl()}/api/${inst.session_name}/status-session`,
        { headers, timeout: 10_000 },
      );
      const status = statusResp.data?.status ?? "unknown";
      const isConnected = status === "CONNECTED" || status === "inChat";

      // Se não veio qrcode no status mas a sessão ainda não está conectada,
      // pega via endpoint dedicado.
      let qrcode = statusResp.data?.qrcode ?? statusResp.data?.qr ?? null;
      if (!qrcode && !isConnected) {
        try {
          const qrResp = await axios.get(
            `${wppBaseUrl()}/api/${inst.session_name}/qrcode-session`,
            { headers, timeout: 8_000, responseType: "arraybuffer" },
          );
          // Pode vir como imagem binária ou como JSON
          const ct = String(qrResp.headers["content-type"] ?? "");
          if (ct.includes("image")) {
            qrcode = `data:${ct};base64,${Buffer.from(qrResp.data).toString("base64")}`;
          } else {
            const text = Buffer.from(qrResp.data).toString("utf-8");
            try {
              const parsed = JSON.parse(text);
              qrcode = parsed.qrcode ?? parsed.qr ?? null;
            } catch { /* não é JSON */ }
          }
        } catch { /* QR ainda não pronto */ }
      }

      await db.query(
        `UPDATE whatsapp_instances
            SET status = $2,
                last_qr = COALESCE($4, last_qr),
                last_connected_at = CASE WHEN $3 THEN NOW() ELSE last_connected_at END,
                updated_at = NOW()
          WHERE id = $1`,
        [id, isConnected ? "connected" : "connecting", isConnected, qrcode],
      );
      return { status, qrcode };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // Refresh webhook — registra o webhook na sessão já ativa.
  // Usado quando a sessão foi iniciada antes do webhook estar configurado.
  // -----------------------------------------------------------------
  app.post("/:id/refresh-webhook", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT session_name, session_token FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    const inst = r.rows[0];

    // O WPP-Connect aceita re-config via close-session + start-session (mantém sessão WA)
    try {
      // Não fecha — usa endpoint dedicado pra atualizar webhook
      await callWpp(inst.session_name, inst.session_token, "/start-session", {
        waitQrCode: false,
      });
      return { ok: true, msg: "webhook re-registrado via start-session" };
    } catch (err: any) {
      return reply.code(502).send({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // Desconectar
  // -----------------------------------------------------------------
  app.post("/:id/logout", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `SELECT session_name, session_token FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    try {
      await callWpp(r.rows[0].session_name, r.rows[0].session_token, "/logout-session");
    } catch { /* tenta deletar mesmo se falhar */ }
    await db.query(
      `UPDATE whatsapp_instances SET status = 'disconnected', updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { ok: true };
  });

  app.delete("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `DELETE FROM whatsapp_instances WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "não encontrado" });
    return { ok: true };
  });
}
