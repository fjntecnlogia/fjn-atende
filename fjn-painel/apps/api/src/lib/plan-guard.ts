/**
 * Helpers para validar features por plano antes de permitir operações.
 */
import { db } from "../db/client";

export interface PlanFeatures {
  slug: string;
  allow_campaigns: boolean;
  allow_meta_cloud: boolean;
  max_campaign_messages_month: number;
  max_contact_list_size: number;
  max_instances: number;
  max_agents: number;
}

export async function getTenantPlan(tenantId: number): Promise<PlanFeatures | null> {
  const r = await db.query<PlanFeatures>(
    `SELECT p.slug, p.allow_campaigns, p.allow_meta_cloud,
            p.max_campaign_messages_month, p.max_contact_list_size,
            p.max_instances, p.max_agents
       FROM tenants t JOIN plans p ON p.slug = t.plan
      WHERE t.id = $1`,
    [tenantId],
  );
  return r.rowCount && r.rowCount > 0 ? r.rows[0] : null;
}

export async function requireCampaignsFeature(tenantId: number): Promise<void> {
  const plan = await getTenantPlan(tenantId);
  if (!plan) throw new Error("Plano não encontrado");
  if (!plan.allow_campaigns) {
    throw Object.assign(new Error("Módulo Campanhas disponível apenas no plano Pro+"), {
      statusCode: 402,
      upgrade_required: true,
    });
  }
}

export async function requireMetaCloudFeature(tenantId: number): Promise<void> {
  const plan = await getTenantPlan(tenantId);
  if (!plan) throw new Error("Plano não encontrado");
  if (!plan.allow_meta_cloud) {
    throw Object.assign(new Error("Meta Cloud API disponível apenas no plano Pro+"), {
      statusCode: 402,
      upgrade_required: true,
    });
  }
}
