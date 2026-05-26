import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

export async function handoffsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const tid = req.tenantId!;
    const q = z.object({
      status: z.enum(["pending", "taken", "resolved", "all"]).default("pending"),
      limit: z.coerce.number().default(100),
    }).parse(req.query);

    const where: string[] = ["h.tenant_id = $1"];
    const params: any[] = [tid];
    if (q.status === "pending") where.push("h.taken_at IS NULL");
    else if (q.status === "taken") where.push("h.taken_at IS NOT NULL AND h.resolved_at IS NULL");
    else if (q.status === "resolved") where.push("h.resolved_at IS NOT NULL");

    params.push(q.limit);

    const result = await db.query(
      `SELECT h.id, h.conversation_id, c.phone AS contact_phone, c.name AS contact_name,
              h.reason, h.trigger_message, h.notified_at, h.taken_at, h.resolved_at
         FROM handoffs h
         JOIN conversations conv ON conv.id = h.conversation_id
         JOIN contacts c ON c.id = conv.contact_id
        WHERE ${where.join(" AND ")}
        ORDER BY h.notified_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  });

  app.post("/:id/take", { preHandler: requireTenant }, async (req) => {
    const id = Number((req.params as any).id);
    await db.query(
      `UPDATE handoffs SET taken_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND taken_at IS NULL`,
      [id, req.tenantId!],
    );
    return { ok: true };
  });

  app.post("/:id/resolve", { preHandler: requireTenant }, async (req) => {
    const id = Number((req.params as any).id);
    await db.query(
      `UPDATE handoffs SET resolved_at = NOW()
        WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId!],
    );
    return { ok: true };
  });
}
