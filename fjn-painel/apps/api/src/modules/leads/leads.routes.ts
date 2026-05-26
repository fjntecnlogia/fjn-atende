import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

export async function leadsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const tid = req.tenantId!;
    const q = z.object({
      product: z.string().optional(),
      stage: z.string().optional(),
      limit: z.coerce.number().default(100),
    }).parse(req.query);

    const where: string[] = ["l.tenant_id = $1"];
    const params: any[] = [tid];
    if (q.product) {
      params.push(q.product);
      where.push(`l.product = $${params.length}`);
    }
    if (q.stage) {
      params.push(q.stage);
      where.push(`l.stage = $${params.length}`);
    }
    params.push(q.limit);

    const result = await db.query(
      `SELECT l.id, l.contact_id, c.phone AS contact_phone, c.name AS contact_name,
              l.product, l.stage, l.notes, l.created_at
         FROM leads l
         JOIN contacts c ON c.id = l.contact_id
        WHERE ${where.join(" AND ")}
        ORDER BY l.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  });

  app.patch("/:id", { preHandler: requireTenant }, async (req) => {
    const id = Number((req.params as any).id);
    const tid = req.tenantId!;
    const body = z.object({
      stage: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.stage) {
      params.push(body.stage);
      sets.push(`stage = $${params.length}`);
    }
    if (body.notes !== undefined) {
      params.push(body.notes);
      sets.push(`notes = $${params.length}`);
    }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = NOW()`);
    params.push(id, tid);
    await db.query(
      `UPDATE leads SET ${sets.join(", ")}
        WHERE id = $${params.length - 1} AND tenant_id = $${params.length}`,
      params,
    );
    return { ok: true };
  });
}
