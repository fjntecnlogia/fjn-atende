import type { FastifyInstance } from "fastify";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/overview", { preHandler: requireTenant }, async (req) => {
    const tid = req.tenantId!;
    const [hoje, ativas, leads, leadsNovos, handoffs, contatos, porProduto, mensagens24h] =
      await Promise.all([
        db.query(`SELECT COUNT(*)::int AS n FROM conversations
                   WHERE tenant_id = $1 AND last_message_at >= NOW() - INTERVAL '24 hours'`, [tid]),
        db.query(`SELECT COUNT(*)::int AS n FROM conversations
                   WHERE tenant_id = $1 AND status = 'active'`, [tid]),
        db.query(`SELECT COUNT(*)::int AS n FROM leads WHERE tenant_id = $1`, [tid]),
        db.query(`SELECT COUNT(*)::int AS n FROM leads
                   WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`, [tid]),
        db.query(`SELECT COUNT(*)::int AS n FROM handoffs
                   WHERE tenant_id = $1 AND resolved_at IS NULL`, [tid]),
        db.query(`SELECT COUNT(*)::int AS n FROM contacts WHERE tenant_id = $1`, [tid]),
        db.query(`SELECT COALESCE(product_detected, 'indefinido') AS product,
                         COUNT(*)::int AS total
                    FROM conversations WHERE tenant_id = $1
                   GROUP BY product_detected ORDER BY total DESC`, [tid]),
        db.query(`SELECT to_char(date_trunc('hour', sent_at), 'HH24:00') AS hour,
                         COUNT(*)::int AS count
                    FROM messages
                   WHERE tenant_id = $1
                     AND sent_at >= NOW() - INTERVAL '24 hours'
                     AND role IN ('user','assistant')
                   GROUP BY 1 ORDER BY 1`, [tid]),
      ]);

    return {
      conversas_hoje: hoje.rows[0].n,
      conversas_ativas: ativas.rows[0].n,
      leads_total: leads.rows[0].n,
      leads_novos_semana: leadsNovos.rows[0].n,
      handoffs_pendentes: handoffs.rows[0].n,
      contatos_total: contatos.rows[0].n,
      por_produto: porProduto.rows,
      mensagens_24h: mensagens24h.rows,
    };
  });
}
