/**
 * Rotas de notas internas por tenant (CRM admin).
 * Apenas super-admin.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireSuperAdmin } from "../../lib/auth";

const noteSchema = z.object({
  body: z.string().min(1).max(5000),
  category: z.enum(["general", "support", "billing", "sales", "churn_risk"]).default("general"),
  pinned: z.boolean().default(false),
});

const noteUpdateSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  category: z.enum(["general", "support", "billing", "sales", "churn_risk"]).optional(),
  pinned: z.boolean().optional(),
});

export async function tenantNotesRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /admin/tenant-notes/:tenantId — lista notas do tenant
  // -------------------------------------------------------------------
  app.get("/:tenantId", { preHandler: requireSuperAdmin }, async (req) => {
    const tenantId = Number((req.params as any).tenantId);
    const r = await db.query(
      `SELECT n.*, u.name AS author_current_name
         FROM tenant_notes n
         LEFT JOIN admin_users u ON u.id = n.author_id
        WHERE n.tenant_id = $1
        ORDER BY n.pinned DESC, n.created_at DESC
        LIMIT 200`,
      [tenantId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // POST /admin/tenant-notes/:tenantId — cria nota
  // -------------------------------------------------------------------
  app.post("/:tenantId", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const tenantId = Number((req.params as any).tenantId);
    const data = noteSchema.parse(req.body);

    // Captura nome do autor (snapshot)
    const u = await db.query(
      `SELECT name FROM admin_users WHERE id = $1`,
      [req.user.sub],
    );

    const r = await db.query(
      `INSERT INTO tenant_notes (tenant_id, author_id, author_name, body, category, pinned)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, req.user.sub, u.rows[0]?.name ?? null, data.body, data.category, data.pinned],
    );
    return reply.code(201).send(r.rows[0]);
  });

  // -------------------------------------------------------------------
  // PATCH /admin/tenant-notes/:noteId — edita nota
  // -------------------------------------------------------------------
  app.patch("/note/:noteId", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const noteId = Number((req.params as any).noteId);
    const data = noteUpdateSchema.parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) return reply.code(400).send({ error: "nada pra atualizar" });
    fields.push(`updated_at = NOW()`);
    values.push(noteId);

    const r = await db.query(
      `UPDATE tenant_notes SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "nota não encontrada" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // DELETE /admin/tenant-notes/:noteId
  // -------------------------------------------------------------------
  app.delete("/note/:noteId", { preHandler: requireSuperAdmin }, async (req, reply) => {
    const noteId = Number((req.params as any).noteId);
    const r = await db.query(
      `DELETE FROM tenant_notes WHERE id = $1 RETURNING id`,
      [noteId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "nota não encontrada" });
    return { ok: true };
  });
}
