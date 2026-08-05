/**
 * Rotas de Cards (conversation_cards).
 *
 * Card = uma conversa dentro de um pipeline numa etapa.
 * Mesma conversa pode estar em N pipelines (Comercial + Suporte).
 *
 * Operações:
 *  - listar com filtros (pipeline, stage, atendente, time, busca)
 *  - detalhe (com history + activities)
 *  - mover de etapa (drag-drop Kanban)
 *  - atribuir user/time
 *  - marcar ganho/perdido
 *  - atualizar valor/follow-up/tags
 *  - CRUD de atividades (notas/tasks/calls)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

// ---------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------
const cardCreateSchema = z.object({
  conversation_id: z.number().int().positive(),
  pipeline_id: z.number().int().positive(),
  stage_id: z.number().int().positive().optional(),  // se omitido = primeira etapa
  assigned_user_id: z.number().int().positive().nullable().optional(),
  assigned_team_id: z.number().int().positive().nullable().optional(),
  value_cents: z.number().int().min(0).default(0),
  expected_close_date: z.string().optional(),  // YYYY-MM-DD
  tags: z.array(z.string()).default([]),
});

const cardUpdateSchema = z.object({
  value_cents: z.number().int().min(0).optional(),
  expected_close_date: z.string().nullable().optional(),
  next_action_at: z.string().nullable().optional(),
  next_action_note: z.string().max(500).nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.any()).optional(),
});

const moveSchema = z.object({
  stage_id: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  position: z.number().int().min(0).optional(),
});

const assignSchema = z.object({
  user_id: z.number().int().positive().nullable().optional(),
  team_id: z.number().int().positive().nullable().optional(),
  use_round_robin: z.boolean().default(false),
});

const lostSchema = z.object({
  reason: z.string().max(500),
  stage_id: z.number().int().positive().optional(),  // etapa marcada como is_lost
});

const activitySchema = z.object({
  type: z.enum(["note", "task", "call", "meeting", "email"]).default("note"),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  due_at: z.string().optional(),
});

// ---------------------------------------------------------------------
// Helper — log no card_history
// ---------------------------------------------------------------------
async function logHistory(
  cardId: number,
  tenantId: number,
  action: string,
  fromValue: any,
  toValue: any,
  reason: string | null,
  userId: number,
) {
  await db.query(
    `INSERT INTO card_history (card_id, tenant_id, action, from_value, to_value, reason, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [cardId, tenantId, action,
     fromValue ? JSON.stringify(fromValue) : null,
     toValue ? JSON.stringify(toValue) : null,
     reason, userId],
  );
}

// ---------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------
export async function cardsRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /cards — lista com filtros
  // ?pipeline_id=&stage_id=&assigned_user_id=&assigned_team_id=
  // ?status=open|won|lost&search=&limit=50&offset=0
  // -------------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const q = req.query as any;
    const limit = Math.min(Number(q.limit ?? 100), 500);
    const offset = Math.max(Number(q.offset ?? 0), 0);

    const conds: string[] = [`c.tenant_id = $1`];
    const params: any[] = [req.tenantId];
    let i = 2;

    if (q.pipeline_id)        { conds.push(`c.pipeline_id = $${i++}`); params.push(Number(q.pipeline_id)); }
    if (q.stage_id)           { conds.push(`c.stage_id = $${i++}`); params.push(Number(q.stage_id)); }
    if (q.assigned_user_id)   { conds.push(`c.assigned_user_id = $${i++}`); params.push(Number(q.assigned_user_id)); }
    if (q.assigned_team_id)   { conds.push(`c.assigned_team_id = $${i++}`); params.push(Number(q.assigned_team_id)); }
    if (q.unassigned === "1") { conds.push(`c.assigned_user_id IS NULL AND c.assigned_team_id IS NULL`); }
    if (q.status === "open")  { conds.push(`c.won_at IS NULL AND c.lost_at IS NULL`); }
    if (q.status === "won")   { conds.push(`c.won_at IS NOT NULL`); }
    if (q.status === "lost")  { conds.push(`c.lost_at IS NOT NULL`); }

    if (q.search) {
      conds.push(`(co.phone ILIKE $${i} OR co.name ILIKE $${i})`);
      params.push(`%${q.search}%`);
      i++;
    }

    const where = conds.join(" AND ");
    params.push(limit, offset);

    const r = await db.query(
      `SELECT c.*,
              s.name AS stage_name, s.color AS stage_color, s.is_won, s.is_lost,
              p.name AS pipeline_name,
              co.phone AS contact_phone, co.name AS contact_name,
              cv.last_message_at,
              u.name  AS assigned_user_name, u.email AS assigned_user_email,
              t.name  AS assigned_team_name, t.color AS assigned_team_color,
              EXTRACT(EPOCH FROM (NOW() - c.stage_entered_at))::int / 3600 AS hours_in_stage
         FROM conversation_cards c
         JOIN pipeline_stages s ON s.id = c.stage_id
         JOIN pipelines       p ON p.id = c.pipeline_id
         JOIN conversations  cv ON cv.id = c.conversation_id
         JOIN contacts       co ON co.id = cv.contact_id
         LEFT JOIN admin_users u ON u.id = c.assigned_user_id
         LEFT JOIN teams       t ON t.id = c.assigned_team_id
        WHERE ${where}
        ORDER BY c.updated_at DESC
        LIMIT $${i++} OFFSET $${i++}`,
      params,
    );

    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /cards/:id — detalhe completo (com history + activities)
  // -------------------------------------------------------------------
  app.get("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);

    const cardRes = await db.query(
      `SELECT c.*,
              s.name AS stage_name, s.color AS stage_color, s.is_won, s.is_lost,
                                     s.win_probability,
              p.name AS pipeline_name,
              co.phone AS contact_phone, co.name AS contact_name, co.id AS contact_id,
              cv.last_message_at, cv.status AS conversation_status,
              u.name AS assigned_user_name, u.email AS assigned_user_email,
              t.name AS assigned_team_name, t.color AS assigned_team_color
         FROM conversation_cards c
         JOIN pipeline_stages s ON s.id = c.stage_id
         JOIN pipelines       p ON p.id = c.pipeline_id
         JOIN conversations  cv ON cv.id = c.conversation_id
         JOIN contacts       co ON co.id = cv.contact_id
         LEFT JOIN admin_users u ON u.id = c.assigned_user_id
         LEFT JOIN teams       t ON t.id = c.assigned_team_id
        WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, req.tenantId],
    );
    if (cardRes.rowCount === 0) return reply.code(404).send({ error: "card não encontrado" });

    const historyRes = await db.query(
      `SELECT h.*, u.name AS changed_by_name
         FROM card_history h
         LEFT JOIN admin_users u ON u.id = h.changed_by
        WHERE h.card_id = $1
        ORDER BY h.changed_at DESC
        LIMIT 100`,
      [id],
    );

    const activitiesRes = await db.query(
      `SELECT a.*, u.name AS created_by_name
         FROM card_activities a
         LEFT JOIN admin_users u ON u.id = a.created_by
        WHERE a.card_id = $1
        ORDER BY a.created_at DESC
        LIMIT 100`,
      [id],
    );

    return {
      ...cardRes.rows[0],
      history: historyRes.rows,
      activities: activitiesRes.rows,
    };
  });

  // -------------------------------------------------------------------
  // POST /cards — cria manualmente (raro — geralmente vem auto)
  // -------------------------------------------------------------------
  app.post("/", { preHandler: requireTenant }, async (req, reply) => {
    const data = cardCreateSchema.parse(req.body);

    // Valida pipeline e conversation pertencem ao tenant
    const valid = await db.query(
      `SELECT
         (SELECT 1 FROM pipelines      WHERE id = $1 AND tenant_id = $3) AS p_ok,
         (SELECT 1 FROM conversations  WHERE id = $2 AND tenant_id = $3) AS c_ok`,
      [data.pipeline_id, data.conversation_id, req.tenantId],
    );
    if (!valid.rows[0].p_ok) return reply.code(400).send({ error: "pipeline inválido" });
    if (!valid.rows[0].c_ok) return reply.code(400).send({ error: "conversation inválida" });

    // Stage default = primeira etapa do pipeline
    let stageId = data.stage_id;
    if (!stageId) {
      const s = await db.query(
        `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY sort_order ASC LIMIT 1`,
        [data.pipeline_id],
      );
      if (s.rowCount === 0) return reply.code(400).send({ error: "pipeline sem etapas" });
      stageId = s.rows[0].id;
    }

    try {
      const numberRes = await db.query(`SELECT next_card_number($1) AS n`, [req.tenantId]);
      const cardNumber = numberRes.rows[0].n;
      const r = await db.query(
        `INSERT INTO conversation_cards
           (tenant_id, conversation_id, pipeline_id, stage_id,
            assigned_user_id, assigned_team_id, value_cents, expected_close_date, tags, number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [req.tenantId, data.conversation_id, data.pipeline_id, stageId,
         data.assigned_user_id ?? null, data.assigned_team_id ?? null,
         data.value_cents, data.expected_close_date ?? null, data.tags, cardNumber],
      );

      await logHistory(r.rows[0].id, req.tenantId!, "created",
        null,
        { pipeline_id: data.pipeline_id, stage_id: stageId },
        null, req.user.sub);

      return reply.code(201).send(r.rows[0]);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.code(409).send({ error: "essa conversa já está neste pipeline" });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------
  // PUT /cards/:id — atualiza dados gerais (valor, tags, follow-up...)
  // -------------------------------------------------------------------
  app.put("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = cardUpdateSchema.parse(req.body);

    // Captura estado atual pra history
    const before = await db.query(
      `SELECT value_cents, tags FROM conversation_cards WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId],
    );
    if (before.rowCount === 0) return reply.code(404).send({ error: "card não encontrado" });

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(k === "custom_fields" ? JSON.stringify(v) : v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    fields.push(`updated_at = NOW()`);
    values.push(id, req.tenantId);

    const r = await db.query(
      `UPDATE conversation_cards SET ${fields.join(", ")}
        WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      values,
    );

    // Log mudança de valor (importante pro forecast)
    if (data.value_cents !== undefined && data.value_cents !== Number(before.rows[0].value_cents)) {
      await logHistory(id, req.tenantId!, "value_changed",
        { value_cents: Number(before.rows[0].value_cents) },
        { value_cents: data.value_cents },
        null, req.user.sub);
    }

    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/move — move pra outra etapa (drag-drop)
  // -------------------------------------------------------------------
  app.post("/:id/move", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const { stage_id, reason, position } = moveSchema.parse(req.body);

    // Valida stage pertence a um pipeline do tenant
    const ok = await db.query(
      `SELECT s.id FROM pipeline_stages s
         JOIN pipelines p ON p.id = s.pipeline_id
        WHERE s.id = $1 AND p.tenant_id = $2`,
      [stage_id, req.tenantId],
    );
    if (ok.rowCount === 0) return reply.code(400).send({ error: "etapa inválida" });

    // Verifica que card pertence ao tenant e a stage é do mesmo pipeline
    const cardCheck = await db.query(
      `SELECT c.id FROM conversation_cards c
         JOIN pipeline_stages s ON s.pipeline_id = c.pipeline_id
        WHERE c.id = $1 AND c.tenant_id = $2 AND s.id = $3`,
      [id, req.tenantId, stage_id],
    );
    if (cardCheck.rowCount === 0) {
      return reply.code(400).send({ error: "etapa não pertence ao pipeline do card" });
    }

    // Move via stored procedure (atualiza stage_entered_at + won/lost + history)
    await db.query(
      `SELECT move_card_to_stage($1, $2, $3, $4)`,
      [id, stage_id, req.user.sub, reason ?? null],
    );

    // Posição opcional (reordenar dentro da coluna)
    if (position !== undefined) {
      await db.query(
        `UPDATE conversation_cards SET position = $1 WHERE id = $2 AND tenant_id = $3`,
        [position, id, req.tenantId],
      );
    }

    const r = await db.query(
      `SELECT * FROM conversation_cards WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/assign — atribui atendente ou time
  // -------------------------------------------------------------------
  app.post("/:id/assign", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = assignSchema.parse(req.body);

    const before = await db.query(
      `SELECT assigned_user_id, assigned_team_id FROM conversation_cards
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId],
    );
    if (before.rowCount === 0) return reply.code(404).send({ error: "card não encontrado" });

    let userId = data.user_id;
    let teamId = data.team_id;

    // Se pediu round-robin, pega próximo do time
    if (data.use_round_robin && teamId) {
      const rr = await db.query(`SELECT pick_next_team_member($1) AS uid`, [teamId]);
      userId = rr.rows[0].uid;
    }

    const r = await db.query(
      `UPDATE conversation_cards
          SET assigned_user_id = $1, assigned_team_id = $2, updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [userId ?? null, teamId ?? null, id, req.tenantId],
    );

    await logHistory(id, req.tenantId!, "assigned",
      { user_id: before.rows[0].assigned_user_id, team_id: before.rows[0].assigned_team_id },
      { user_id: userId ?? null, team_id: teamId ?? null, round_robin: data.use_round_robin },
      null, req.user.sub);

    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/win — marca como ganho (move pra etapa is_won=true)
  // -------------------------------------------------------------------
  app.post("/:id/win", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      stage_id: z.number().int().positive().optional(),
      reason: z.string().max(500).optional(),
    }).parse(req.body);

    // Acha etapa "ganho" do pipeline do card
    let stageId = body.stage_id;
    if (!stageId) {
      const s = await db.query(
        `SELECT s.id FROM pipeline_stages s
           JOIN conversation_cards c ON c.pipeline_id = s.pipeline_id
          WHERE c.id = $1 AND c.tenant_id = $2 AND s.is_won = TRUE
          LIMIT 1`,
        [id, req.tenantId],
      );
      if (s.rowCount === 0) return reply.code(400).send({ error: "pipeline sem etapa de ganho" });
      stageId = s.rows[0].id;
    }

    await db.query(`SELECT move_card_to_stage($1, $2, $3, $4)`,
      [id, stageId, req.user.sub, body.reason ?? null]);

    const r = await db.query(`SELECT * FROM conversation_cards WHERE id = $1`, [id]);
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/lose — marca como perdido (com razão obrigatória)
  // -------------------------------------------------------------------
  app.post("/:id/lose", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const { reason, stage_id } = lostSchema.parse(req.body);

    let stageId = stage_id;
    if (!stageId) {
      const s = await db.query(
        `SELECT s.id FROM pipeline_stages s
           JOIN conversation_cards c ON c.pipeline_id = s.pipeline_id
          WHERE c.id = $1 AND c.tenant_id = $2 AND s.is_lost = TRUE
          LIMIT 1`,
        [id, req.tenantId],
      );
      if (s.rowCount === 0) return reply.code(400).send({ error: "pipeline sem etapa de perdido" });
      stageId = s.rows[0].id;
    }

    await db.query(`SELECT move_card_to_stage($1, $2, $3, $4)`,
      [id, stageId, req.user.sub, reason]);

    // Salva também o lost_reason no card (além de no history)
    await db.query(
      `UPDATE conversation_cards SET lost_reason = $1 WHERE id = $2`,
      [reason, id],
    );

    const r = await db.query(`SELECT * FROM conversation_cards WHERE id = $1`, [id]);
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/reopen — reabre card (limpa won_at/lost_at)
  // -------------------------------------------------------------------
  app.post("/:id/reopen", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);

    const r = await db.query(
      `UPDATE conversation_cards
          SET won_at = NULL, lost_at = NULL, lost_reason = NULL,
              stage_entered_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "card não encontrado" });

    await logHistory(id, req.tenantId!, "reopened", null, null, null, req.user.sub);
    return r.rows[0];
  });

  // ===================================================================
  // ACTIVITIES (notas, tarefas, ligações)
  // ===================================================================

  // -------------------------------------------------------------------
  // POST /cards/:id/activities — cria nota/tarefa
  // -------------------------------------------------------------------
  app.post("/:id/activities", { preHandler: requireTenant }, async (req, reply) => {
    const cardId = Number((req.params as any).id);
    const data = activitySchema.parse(req.body);

    // Confirma que o card pertence ao tenant
    const c = await db.query(
      `SELECT id FROM conversation_cards WHERE id = $1 AND tenant_id = $2`,
      [cardId, req.tenantId],
    );
    if (c.rowCount === 0) return reply.code(404).send({ error: "card não encontrado" });

    const r = await db.query(
      `INSERT INTO card_activities (card_id, tenant_id, type, title, body, due_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [cardId, req.tenantId, data.type, data.title ?? null, data.body ?? null,
       data.due_at ?? null, req.user.sub],
    );

    await logHistory(cardId, req.tenantId!, "note_added", null,
      { type: data.type, title: data.title }, null, req.user.sub);

    return reply.code(201).send(r.rows[0]);
  });

  // -------------------------------------------------------------------
  // POST /cards/:id/activities/:actId/done — marca tarefa como concluída
  // -------------------------------------------------------------------
  app.post("/:id/activities/:actId/done", { preHandler: requireTenant }, async (req, reply) => {
    const cardId = Number((req.params as any).id);
    const actId = Number((req.params as any).actId);

    const r = await db.query(
      `UPDATE card_activities SET done_at = NOW()
        WHERE id = $1 AND card_id = $2 AND tenant_id = $3 AND done_at IS NULL
        RETURNING *`,
      [actId, cardId, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "atividade não encontrada ou já concluída" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // DELETE /cards/:id/activities/:actId
  // -------------------------------------------------------------------
  app.delete("/:id/activities/:actId", { preHandler: requireTenant }, async (req, reply) => {
    const cardId = Number((req.params as any).id);
    const actId = Number((req.params as any).actId);

    const r = await db.query(
      `DELETE FROM card_activities
        WHERE id = $1 AND card_id = $2 AND tenant_id = $3
        RETURNING id`,
      [actId, cardId, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "atividade não encontrada" });
    return { ok: true };
  });
}
