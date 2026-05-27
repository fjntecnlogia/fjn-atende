/**
 * Rotas de Pipelines + Stages (etapas).
 *
 * Pipeline = funil customizável. Tenant pode ter vários (Comercial, Suporte, etc).
 * Stage = etapa dentro de um pipeline (Novo, Qualificando, Ganho, Perdido...).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

const pipelineCreateSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  color: z.string().regex(colorRegex).default("#FFBA00"),
  icon: z.string().max(40).default("briefcase"),
  is_default: z.boolean().default(false),
});

const pipelineUpdateSchema = pipelineCreateSchema.partial();

const stageCreateSchema = z.object({
  name: z.string().min(2).max(60),
  color: z.string().regex(colorRegex).default("#1A2358"),
  sort_order: z.number().int().min(0),
  sla_hours: z.number().int().min(1).optional(),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
  win_probability: z.number().int().min(0).max(100).default(50),
});

const stageUpdateSchema = stageCreateSchema.partial();

const stagesReorderSchema = z.object({
  stages: z.array(z.object({
    id: z.number().int().positive(),
    sort_order: z.number().int().min(0),
  })).min(1),
});

export async function pipelinesRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /pipelines — lista todos os pipelines do tenant
  // -------------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM pipeline_stages s WHERE s.pipeline_id = p.id)::int AS stages_count,
              (SELECT COUNT(*) FROM conversation_cards c
                 WHERE c.pipeline_id = p.id AND c.won_at IS NULL AND c.lost_at IS NULL)::int AS open_cards_count
         FROM pipelines p
        WHERE p.tenant_id = $1 AND p.archived = FALSE
        ORDER BY p.is_default DESC, p.sort_order ASC, p.created_at ASC`,
      [req.tenantId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /pipelines/:id — detalhe + stages
  // -------------------------------------------------------------------
  app.get("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const pipelineRes = await db.query(
      `SELECT * FROM pipelines WHERE id = $1 AND tenant_id = $2 AND archived = FALSE`,
      [id, req.tenantId],
    );
    if (pipelineRes.rowCount === 0) {
      return reply.code(404).send({ error: "pipeline não encontrado" });
    }
    const stagesRes = await db.query(
      `SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY sort_order ASC`,
      [id],
    );
    return {
      ...pipelineRes.rows[0],
      stages: stagesRes.rows,
    };
  });

  // -------------------------------------------------------------------
  // POST /pipelines — cria pipeline
  // -------------------------------------------------------------------
  app.post("/", { preHandler: requireTenant }, async (req, reply) => {
    const data = pipelineCreateSchema.parse(req.body);

    // Se marcar como default, desmarca os outros
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      if (data.is_default) {
        await client.query(
          `UPDATE pipelines SET is_default = FALSE WHERE tenant_id = $1`,
          [req.tenantId],
        );
      }

      // sort_order = próximo disponível
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM pipelines WHERE tenant_id = $1`,
        [req.tenantId],
      );

      const r = await client.query(
        `INSERT INTO pipelines (tenant_id, name, description, color, icon, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.tenantId, data.name, data.description ?? null, data.color, data.icon, data.is_default, maxRes.rows[0].next],
      );

      await client.query("COMMIT");
      return reply.code(201).send(r.rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------
  // PUT /pipelines/:id — atualiza
  // -------------------------------------------------------------------
  app.put("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const data = pipelineUpdateSchema.parse(req.body);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      if (data.is_default === true) {
        await client.query(
          `UPDATE pipelines SET is_default = FALSE WHERE tenant_id = $1 AND id != $2`,
          [req.tenantId, id],
        );
      }

      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(data)) {
        fields.push(`${k} = $${i++}`);
        values.push(v);
      }
      if (fields.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ error: "nada pra atualizar" });
      }
      fields.push(`updated_at = NOW()`);
      values.push(id, req.tenantId);

      const r = await client.query(
        `UPDATE pipelines SET ${fields.join(", ")}
          WHERE id = $${i++} AND tenant_id = $${i++}
          RETURNING *`,
        values,
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "pipeline não encontrado" });
      }

      await client.query("COMMIT");
      return r.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------
  // DELETE /pipelines/:id — soft delete (archive)
  // -------------------------------------------------------------------
  app.delete("/:id", { preHandler: requireTenant }, async (req, reply) => {
    const id = Number((req.params as any).id);

    // Não permite deletar o último pipeline (precisa ter pelo menos um pra novos cards)
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM pipelines WHERE tenant_id = $1 AND archived = FALSE`,
      [req.tenantId],
    );
    if (countRes.rows[0].c <= 1) {
      return reply.code(400).send({ error: "não pode arquivar o último pipeline" });
    }

    const r = await db.query(
      `UPDATE pipelines SET archived = TRUE, is_default = FALSE, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id`,
      [id, req.tenantId],
    );
    if (r.rowCount === 0) {
      return reply.code(404).send({ error: "pipeline não encontrado" });
    }
    return { ok: true };
  });

  // ===================================================================
  // STAGES
  // ===================================================================

  // -------------------------------------------------------------------
  // GET /pipelines/:id/stages — lista etapas do pipeline
  // -------------------------------------------------------------------
  app.get("/:id/stages", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);

    // Valida que o pipeline pertence ao tenant
    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    const r = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM conversation_cards c
                 WHERE c.stage_id = s.id AND c.won_at IS NULL AND c.lost_at IS NULL)::int AS open_cards
         FROM pipeline_stages s
        WHERE s.pipeline_id = $1
        ORDER BY s.sort_order ASC`,
      [pipelineId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // POST /pipelines/:id/stages — cria etapa
  // -------------------------------------------------------------------
  app.post("/:id/stages", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);
    const data = stageCreateSchema.parse(req.body);

    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2 AND archived = FALSE`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    const r = await db.query(
      `INSERT INTO pipeline_stages
         (pipeline_id, name, color, sort_order, sla_hours, is_won, is_lost, win_probability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [pipelineId, data.name, data.color, data.sort_order, data.sla_hours ?? null,
       data.is_won, data.is_lost, data.win_probability],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // -------------------------------------------------------------------
  // PUT /pipelines/:id/stages/:stageId — atualiza etapa
  // -------------------------------------------------------------------
  app.put("/:id/stages/:stageId", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);
    const stageId = Number((req.params as any).stageId);
    const data = stageUpdateSchema.parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    values.push(stageId, pipelineId, req.tenantId);

    const r = await db.query(
      `UPDATE pipeline_stages SET ${fields.join(", ")}
        WHERE id = $${i++}
          AND pipeline_id = $${i++}
          AND pipeline_id IN (SELECT id FROM pipelines WHERE tenant_id = $${i++})
        RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "etapa não encontrada" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // PUT /pipelines/:id/stages/reorder — reordena etapas em massa
  // -------------------------------------------------------------------
  app.put("/:id/stages/reorder", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);
    const { stages } = stagesReorderSchema.parse(req.body);

    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const s of stages) {
        await client.query(
          `UPDATE pipeline_stages SET sort_order = $1
            WHERE id = $2 AND pipeline_id = $3`,
          [s.sort_order, s.id, pipelineId],
        );
      }
      await client.query("COMMIT");
      return { ok: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------
  // DELETE /pipelines/:id/stages/:stageId — apaga etapa (se não tiver cards)
  // -------------------------------------------------------------------
  app.delete("/:id/stages/:stageId", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);
    const stageId = Number((req.params as any).stageId);

    // Bloqueia se tiver cards
    const c = await db.query(
      `SELECT COUNT(*)::int AS c FROM conversation_cards WHERE stage_id = $1`,
      [stageId],
    );
    if (c.rows[0].c > 0) {
      return reply.code(400).send({
        error: `etapa tem ${c.rows[0].c} card(s) — mova-os antes de apagar`,
      });
    }

    const r = await db.query(
      `DELETE FROM pipeline_stages
        WHERE id = $1
          AND pipeline_id = $2
          AND pipeline_id IN (SELECT id FROM pipelines WHERE tenant_id = $3)
        RETURNING id`,
      [stageId, pipelineId, req.tenantId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "etapa não encontrada" });
    return { ok: true };
  });
}
