/**
 * Rotas de Teams (equipes) + Members.
 *
 * Team = grupo de atendentes que recebe conversas.
 * Strategy: manual | round_robin | least_busy.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

const teamCreateSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  color: z.string().regex(colorRegex).default("#1A2358"),
  assignment_strategy: z.enum(["manual", "round_robin", "least_busy"]).default("manual"),
  business_hours: z.record(z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).optional(),
});

const teamUpdateSchema = teamCreateSchema.partial();

const memberAddSchema = z.object({
  user_id: z.number().int().positive(),
  is_lead: z.boolean().default(false),
  available: z.boolean().default(true),
});

export async function teamsRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /teams — lista times do tenant
  // -------------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id)::int AS members_count,
              (SELECT COUNT(*) FROM conversation_cards c
                 WHERE c.assigned_team_id = t.id AND c.won_at IS NULL AND c.lost_at IS NULL)::int AS open_cards
         FROM teams t
        WHERE t.tenant_id = $1 AND t.archived = FALSE
        ORDER BY t.created_at ASC`,
      [req.tenantId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /teams/:id — detalhe + membros
  // -------------------------------------------------------------------
  app.get("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const t = await db.query(
      `SELECT * FROM teams WHERE id = $1 AND tenant_id = $2 AND archived = FALSE`,
      [id, req.tenantId],
    );
    if (t.rowCount === 0) return reply.code(404).send({ error: "time não encontrado" });

    const members = await db.query(
      `SELECT tm.*, u.email, u.name, u.role, u.active
         FROM team_members tm
         JOIN admin_users u ON u.id = tm.user_id
        WHERE tm.team_id = $1
        ORDER BY tm.is_lead DESC, tm.joined_at ASC`,
      [id],
    );
    return { ...t.rows[0], members: members.rows };
  });

  // -------------------------------------------------------------------
  // POST /teams — cria
  // -------------------------------------------------------------------
  app.post("/", { preHandler: requireTenant }, async (req, reply) => {
    const data = teamCreateSchema.parse(req.body);
    const r = await db.query(
      `INSERT INTO teams (tenant_id, name, description, color, assignment_strategy, business_hours)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.tenantId, data.name, data.description ?? null, data.color, data.assignment_strategy,
       data.business_hours ? JSON.stringify(data.business_hours) : null],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // -------------------------------------------------------------------
  // PUT /teams/:id
  // -------------------------------------------------------------------
  app.put("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = teamUpdateSchema.parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(k === "business_hours" ? JSON.stringify(v) : v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    fields.push(`updated_at = NOW()`);
    values.push(id, req.tenantId);

    const r = await db.query(
      `UPDATE teams SET ${fields.join(", ")}
        WHERE id = $${i++} AND tenant_id = $${i++}
        RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "time não encontrado" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // DELETE /teams/:id — archive
  // -------------------------------------------------------------------
  app.delete("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const r = await db.query(
      `UPDATE teams SET archived = TRUE, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "time não encontrado" });
    return { ok: true };
  });

  // ===================================================================
  // MEMBROS
  // ===================================================================

  // -------------------------------------------------------------------
  // POST /teams/:id/members — adiciona usuário ao time
  // -------------------------------------------------------------------
  app.post("/:id/members", { preHandler: requireTenant }, async (req, reply) => {
    const teamId = Number((req.params as any).id);
    const data = memberAddSchema.parse(req.body);

    // Valida que o time pertence ao tenant
    const t = await db.query(
      `SELECT id FROM teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, req.tenantId],
    );
    if (t.rowCount === 0) return reply.code(404).send({ error: "time não encontrado" });

    // Valida que o usuário pertence ao tenant (ou é super-admin)
    const u = await db.query(
      `SELECT id FROM admin_users
        WHERE id = $1 AND (tenant_id = $2 OR role = 'super_admin')`,
      [data.user_id, req.tenantId],
    );
    if (u.rowCount === 0) return reply.code(404).send({ error: "usuário não encontrado" });

    try {
      const r = await db.query(
        `INSERT INTO team_members (team_id, user_id, is_lead, available)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [teamId, data.user_id, data.is_lead, data.available],
      );
      return reply.code(201).send(r.rows[0]);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.code(409).send({ error: "usuário já é membro deste time" });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------
  // PUT /teams/:id/members/:userId — atualiza papel/disponibilidade
  // -------------------------------------------------------------------
  app.put("/:id/members/:userId", { preHandler: requireTenant }, async (req, reply) => {
    const teamId = Number((req.params as any).id);
    const userId = Number((req.params as any).userId);
    const data = z.object({
      is_lead: z.boolean().optional(),
      available: z.boolean().optional(),
    }).parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    values.push(teamId, userId, req.tenantId);

    const r = await db.query(
      `UPDATE team_members SET ${fields.join(", ")}
        WHERE team_id = $${i++} AND user_id = $${i++}
          AND team_id IN (SELECT id FROM teams WHERE tenant_id = $${i++})
        RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "membro não encontrado" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // DELETE /teams/:id/members/:userId — remove usuário do time
  // -------------------------------------------------------------------
  app.delete("/:id/members/:userId", { preHandler: requireTenant }, async (req, reply) => {
    const teamId = Number((req.params as any).id);
    const userId = Number((req.params as any).userId);

    const r = await db.query(
      `DELETE FROM team_members
        WHERE team_id = $1 AND user_id = $2
          AND team_id IN (SELECT id FROM teams WHERE tenant_id = $3)
        RETURNING team_id`,
      [teamId, userId, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "membro não encontrado" });
    return { ok: true };
  });

  // -------------------------------------------------------------------
  // POST /teams/:id/pick-next — utilitário: retorna o próximo do round-robin
  // (não atribui — só retorna user_id)
  // -------------------------------------------------------------------
  app.post("/:id/pick-next", { preHandler: requireTenant }, async (req, reply) => {
    const teamId = Number((req.params as any).id);

    const t = await db.query(
      `SELECT id FROM teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, req.tenantId],
    );
    if (t.rowCount === 0) return reply.code(404).send({ error: "time não encontrado" });

    const r = await db.query(`SELECT pick_next_team_member($1) AS user_id`, [teamId]);
    return { user_id: r.rows[0].user_id };
  });
}
