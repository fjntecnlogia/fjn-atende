import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";
import { sendText } from "../../lib/ultramsg";

const querySchema = z.object({
  status: z.enum(["active", "paused", "closed", "all"]).default("all"),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function conversationsRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Lista (filtra por tenant_id)
  // -----------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const tid = req.tenantId!;
    const q = querySchema.parse(req.query);
    const where: string[] = ["conv.tenant_id = $1"];
    const params: any[] = [tid];
    if (q.status !== "all") {
      params.push(q.status);
      where.push(`conv.status = $${params.length}`);
    }
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(c.phone ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    params.push(q.limit, q.offset);

    const result = await db.query(
      `SELECT conv.id, conv.contact_id,
              c.phone        AS contact_phone,
              c.name         AS contact_name,
              conv.product_detected, conv.status, conv.bot_paused_until,
              conv.assigned_to, conv.last_message_at,
              (SELECT content FROM messages
                WHERE conversation_id = conv.id ORDER BY id DESC LIMIT 1) AS last_message_preview,
              (SELECT COUNT(*)::int FROM messages
                WHERE conversation_id = conv.id AND role = 'user'
                  AND (conv.last_read_message_id IS NULL OR id > conv.last_read_message_id)
              ) AS unread_count
         FROM conversations conv
         JOIN contacts c ON c.id = conv.contact_id
        WHERE ${where.join(" AND ")}
        ORDER BY conv.last_message_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return result.rows;
  });

  // -----------------------------------------------------------------
  // Helper: garante conversa pertence ao tenant
  // -----------------------------------------------------------------
  async function ensureConversationInTenant(id: number, tid: number) {
    const r = await db.query(
      `SELECT id FROM conversations WHERE id = $1 AND tenant_id = $2`,
      [id, tid],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // -----------------------------------------------------------------
  // Mensagens
  // -----------------------------------------------------------------
  app.get("/:id/messages", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const result = await db.query(
      `SELECT id, role, content, sent_at FROM messages
        WHERE conversation_id = $1 AND tenant_id = $2
        ORDER BY id ASC`,
      [id, req.tenantId!],
    );
    return result.rows;
  });

  app.post("/:id/read", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const last = await db.query(
      `SELECT MAX(id) AS max FROM messages WHERE conversation_id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    await db.query(
      `UPDATE conversations SET last_read_message_id = $3, last_read_at = NOW()
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!, last.rows[0].max ?? 0],
    );
    return { ok: true };
  });

  // Pausar / retomar bot
  app.post("/:id/pause", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const body = z.object({ minutes: z.number().min(0).max(10080).default(0) }).parse(req.body ?? {});
    if (body.minutes === 0) {
      await db.query(
        `UPDATE conversations SET status = 'paused', bot_paused_until = NULL
          WHERE id = $1 AND tenant_id = $2`,
        [id, req.tenantId!],
      );
    } else {
      await db.query(
        `UPDATE conversations SET bot_paused_until = NOW() + ($3 || ' minutes')::interval
          WHERE id = $1 AND tenant_id = $2`,
        [id, req.tenantId!, body.minutes],
      );
    }
    return { ok: true };
  });

  app.post("/:id/resume", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    await db.query(
      `UPDATE conversations
          SET status = 'active', bot_paused_until = NULL, assigned_to = NULL
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    return { ok: true };
  });

  app.post("/:id/assign", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const body = z.object({ assigned_to: z.string().nullable() }).parse(req.body);
    await db.query(
      `UPDATE conversations SET assigned_to = $3
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!, body.assigned_to],
    );
    return { ok: true };
  });

  // -----------------------------------------------------------------
  // Notas
  // -----------------------------------------------------------------
  app.get("/:id/notes", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const result = await db.query(
      `SELECT n.id, n.body, n.created_at, u.name AS author
         FROM conversation_notes n
    LEFT JOIN admin_users u ON u.id = n.admin_user_id
        WHERE n.conversation_id = $1 AND n.tenant_id = $2
        ORDER BY n.id DESC`,
      [id, req.tenantId!],
    );
    return result.rows;
  });

  app.post("/:id/notes", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const body = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    await db.query(
      `INSERT INTO conversation_notes (tenant_id, conversation_id, admin_user_id, body)
       VALUES ($1, $2, $3, $4)`,
      [req.tenantId!, id, req.user.sub, body.body],
    );
    return { ok: true };
  });

  // -----------------------------------------------------------------
  // Envio manual (operador humano)
  // -----------------------------------------------------------------
  app.post("/:id/send", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!(await ensureConversationInTenant(id, req.tenantId!))) return reply.code(404).send({ error: "não encontrado" });
    const body = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);

    const result = await db.query(
      `SELECT c.phone FROM conversations conv
         JOIN contacts c ON c.id = conv.contact_id
        WHERE conv.id = $1 AND conv.tenant_id = $2`,
      [id, req.tenantId!],
    );
    if (result.rowCount === 0) return reply.code(404).send({ error: "conversa não encontrada" });
    const phone = result.rows[0].phone;

    try {
      // TODO multi-tenant: usar a instância WhatsApp do tenant atual
      // (atualmente envia pela instância global). Refatorar quando tivermos
      // multi-sessão real no fjn-atendimento.
      await sendText(phone, body.content);
    } catch (err: any) {
      return reply.code(502).send({ error: `provider falhou: ${err.message}` });
    }

    await db.query(
      `UPDATE conversations
          SET bot_paused_until = NOW() + INTERVAL '60 minutes',
              assigned_to = $3, last_message_at = NOW()
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!, req.user.email],
    );
    await db.query(
      `INSERT INTO messages (tenant_id, conversation_id, role, content)
       VALUES ($1, $2, 'human_agent', $3)`,
      [req.tenantId!, id, body.content],
    );
    return { ok: true };
  });
}
