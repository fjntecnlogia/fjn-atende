/**
 * Rotas de métricas do funil.
 *
 *  GET /funnel-metrics/pipeline/:id         → contagem + valor por etapa
 *  GET /funnel-metrics/pipeline/:id/forecast → forecast (valor × probabilidade)
 *  GET /funnel-metrics/pipeline/:id/conversion → taxa de conversão entre etapas
 *  GET /funnel-metrics/users               → performance por atendente
 *  GET /funnel-metrics/overview            → resumo geral do tenant
 */
import type { FastifyInstance } from "fastify";
import { db } from "../../db/client";
import { requireTenant } from "../../lib/auth";

export async function funnelMetricsRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /funnel-metrics/overview
  // -------------------------------------------------------------------
  app.get("/overview", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM pipelines
           WHERE tenant_id = $1 AND archived = FALSE)            AS pipelines_count,
         (SELECT COUNT(*)::int FROM conversation_cards
           WHERE tenant_id = $1 AND won_at IS NULL AND lost_at IS NULL) AS open_cards,
         (SELECT COUNT(*)::int FROM conversation_cards
           WHERE tenant_id = $1 AND won_at IS NOT NULL
             AND won_at > NOW() - INTERVAL '30 days')            AS won_30d,
         (SELECT COUNT(*)::int FROM conversation_cards
           WHERE tenant_id = $1 AND lost_at IS NOT NULL
             AND lost_at > NOW() - INTERVAL '30 days')           AS lost_30d,
         (SELECT COALESCE(SUM(value_cents), 0)::bigint FROM conversation_cards
           WHERE tenant_id = $1 AND won_at IS NOT NULL
             AND won_at > NOW() - INTERVAL '30 days')            AS won_value_30d,
         (SELECT COALESCE(SUM(value_cents), 0)::bigint FROM conversation_cards
           WHERE tenant_id = $1 AND won_at IS NULL AND lost_at IS NULL) AS pipeline_value_total,
         (SELECT COUNT(*)::int FROM teams
           WHERE tenant_id = $1 AND archived = FALSE)            AS teams_count,
         (SELECT COUNT(*)::int FROM card_activities a
           JOIN conversation_cards c ON c.id = a.card_id
          WHERE c.tenant_id = $1 AND a.done_at IS NULL
            AND a.due_at < NOW())                                AS overdue_activities`,
      [req.tenantId],
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // GET /funnel-metrics/pipeline/:id
  // Contagem + valor + tempo médio por etapa
  // -------------------------------------------------------------------
  app.get("/pipeline/:id", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);

    // Confirma propriedade
    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    const r = await db.query(
      `SELECT
         s.id AS stage_id, s.name AS stage_name, s.color, s.sort_order,
         s.is_won, s.is_lost, s.win_probability,
         COUNT(c.id)::int AS card_count,
         COALESCE(SUM(c.value_cents), 0)::bigint AS total_value_cents,
         COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - c.stage_entered_at)) / 3600)
                  FILTER (WHERE c.won_at IS NULL AND c.lost_at IS NULL), 0)::int
           AS avg_hours_in_stage
       FROM pipeline_stages s
       LEFT JOIN conversation_cards c
              ON c.stage_id = s.id
             AND c.tenant_id = $1
             AND c.won_at IS NULL AND c.lost_at IS NULL
      WHERE s.pipeline_id = $2
      GROUP BY s.id, s.name, s.color, s.sort_order, s.is_won, s.is_lost, s.win_probability
      ORDER BY s.sort_order ASC`,
      [req.tenantId, pipelineId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /funnel-metrics/pipeline/:id/forecast
  // Forecast = soma de (value × win_probability/100) por etapa aberta
  // -------------------------------------------------------------------
  app.get("/pipeline/:id/forecast", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);

    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    const r = await db.query(
      `SELECT
         s.id AS stage_id, s.name AS stage_name, s.win_probability,
         COUNT(c.id)::int AS card_count,
         COALESCE(SUM(c.value_cents), 0)::bigint AS gross_value_cents,
         COALESCE(SUM(c.value_cents * s.win_probability / 100.0), 0)::bigint AS forecast_value_cents
       FROM pipeline_stages s
       LEFT JOIN conversation_cards c
              ON c.stage_id = s.id
             AND c.tenant_id = $1
             AND c.won_at IS NULL AND c.lost_at IS NULL
      WHERE s.pipeline_id = $2
        AND s.is_won = FALSE AND s.is_lost = FALSE
      GROUP BY s.id, s.name, s.win_probability, s.sort_order
      ORDER BY s.sort_order ASC`,
      [req.tenantId, pipelineId],
    );

    const total = r.rows.reduce((acc, row) => acc + Number(row.forecast_value_cents), 0);
    return { stages: r.rows, total_forecast_cents: total };
  });

  // -------------------------------------------------------------------
  // GET /funnel-metrics/pipeline/:id/conversion
  // Taxa de conversão entre etapas (qto % avançou da etapa N pra N+1)
  // Baseado em card_history (action='moved_stage')
  // -------------------------------------------------------------------
  app.get("/pipeline/:id/conversion", { preHandler: requireTenant }, async (req, reply) => {
    const pipelineId = Number((req.params as any).id);

    const p = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND tenant_id = $2`,
      [pipelineId, req.tenantId],
    );
    if (p.rowCount === 0) return reply.code(404).send({ error: "pipeline não encontrado" });

    // Pra cada etapa: quantos cards passaram por ela vs quantos avançaram
    const r = await db.query(
      `WITH stages_ord AS (
         SELECT id, name, sort_order
           FROM pipeline_stages WHERE pipeline_id = $2
       ),
       reached AS (
         -- cards que JÁ passaram por cada etapa
         SELECT s.id AS stage_id, COUNT(DISTINCT c.id)::int AS cards_reached
           FROM stages_ord s
           LEFT JOIN conversation_cards c
                  ON c.tenant_id = $1
                 AND c.pipeline_id = $2
                 AND EXISTS (
                   SELECT 1 FROM card_history h
                    WHERE h.card_id = c.id
                      AND (h.to_value->>'stage_id')::int = s.id
                 )
          GROUP BY s.id
       ),
       advanced AS (
         -- cards que SAÍRAM dessa etapa (moveram pra próxima)
         SELECT s.id AS stage_id, COUNT(DISTINCT h.card_id)::int AS cards_advanced
           FROM stages_ord s
           LEFT JOIN card_history h
                  ON (h.from_value->>'stage_id')::int = s.id
                 AND h.action IN ('moved_stage', 'won')
                 AND h.tenant_id = $1
          GROUP BY s.id
       )
       SELECT s.id AS stage_id, s.name AS stage_name, s.sort_order,
              COALESCE(r.cards_reached, 0)  AS cards_reached,
              COALESCE(a.cards_advanced, 0) AS cards_advanced,
              CASE WHEN COALESCE(r.cards_reached, 0) > 0
                   THEN ROUND(COALESCE(a.cards_advanced, 0)::numeric * 100
                              / r.cards_reached, 1)
                   ELSE 0 END AS conversion_rate_pct
         FROM stages_ord s
         LEFT JOIN reached  r ON r.stage_id = s.id
         LEFT JOIN advanced a ON a.stage_id = s.id
        ORDER BY s.sort_order ASC`,
      [req.tenantId, pipelineId],
    );
    return { items: r.rows };
  });

  // -------------------------------------------------------------------
  // GET /funnel-metrics/users
  // Performance por atendente
  // -------------------------------------------------------------------
  app.get("/users", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT * FROM user_performance_view WHERE tenant_id = $1
        ORDER BY won_value_cents DESC NULLS LAST, open_cards DESC`,
      [req.tenantId],
    );
    return { items: r.rows };
  });
}
