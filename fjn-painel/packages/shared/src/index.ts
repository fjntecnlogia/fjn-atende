// =====================================================================
// Tipos compartilhados — FJN Atende
// =====================================================================

export type Plan = "trial" | "starter" | "pro" | "enterprise";
export type TenantStatus = "active" | "suspended" | "canceled";
export type AdminRole = "super_admin" | "owner" | "admin" | "agent";
export type ConversationStatus = "active" | "paused" | "closed";
export type MessageRole = "user" | "assistant" | "system" | "human_agent";
export type WhatsAppStatus = "pending" | "connecting" | "connected" | "disconnected" | "error";

// ---------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------

export interface TenantBranding {
  display_name?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string | null;
}

export interface AiPersona {
  name?: string;       // "Ana", "Carlos"
  tone?: string;       // "caloroso e direto"
  rules?: string[];    // regras adicionais
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: Plan;
  status: TenantStatus;
  settings: Record<string, unknown>;
  branding: TenantBranding;
  ai_persona: AiPersona;
  prompt_master: string | null;
  notify_phone: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------

export interface PlanDef {
  id: number;
  slug: string;
  name: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  max_messages_month: number;
  max_agents: number;
  max_instances: number;
  features: Record<string, unknown>;
  active: boolean;
}

// ---------------------------------------------------------------------
// Admin user
// ---------------------------------------------------------------------

export interface AdminUser {
  id: number;
  tenant_id: number | null;
  email: string;
  name: string;
  role: AdminRole;
}

// ---------------------------------------------------------------------
// Operacionais
// ---------------------------------------------------------------------

export interface Contact {
  id: number;
  tenant_id: number;
  phone: string;
  name: string | null;
  first_seen: string;
  last_seen: string;
  tags: string[];
}

export interface Conversation {
  id: number;
  tenant_id: number;
  contact_id: number;
  contact_phone: string;
  contact_name: string | null;
  product_detected: string | null;
  status: ConversationStatus;
  bot_paused_until: string | null;
  assigned_to: string | null;
  last_message_at: string;
  unread_count?: number;
  last_message_preview?: string;
}

export interface Message {
  id: number;
  tenant_id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  sent_at: string;
}

export interface Lead {
  id: number;
  tenant_id: number;
  contact_id: number;
  contact_phone: string;
  contact_name: string | null;
  product: string;
  stage: string;
  notes: string | null;
  created_at: string;
}

export interface Handoff {
  id: number;
  tenant_id: number;
  conversation_id: number;
  contact_phone: string;
  contact_name: string | null;
  reason: string;
  trigger_message: string | null;
  notified_at: string;
  taken_at: string | null;
  resolved_at: string | null;
}

export interface WhatsAppInstance {
  id: number;
  tenant_id: number;
  session_name: string;
  phone_number: string | null;
  status: WhatsAppStatus;
  last_qr: string | null;
  last_qr_at: string | null;
  last_connected_at: string | null;
}

export interface TenantKnowledge {
  id: number;
  tenant_id: number;
  key: string;
  title: string;
  content: string;
  enabled: boolean;
  position: number;
}

export interface TenantUsage {
  tenant_id: number;
  period: string;
  messages_sent: number;
  messages_received: number;
  conversations: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  campaign_messages_sent?: number;
}

// ---------------------------------------------------------------------
// Campanhas (FJN Disparo)
// ---------------------------------------------------------------------

export type CampaignProvider = "wppconnect" | "meta_cloud" | "evolution" | "ultramsg";
export type CampaignStatus =
  | "draft" | "scheduled" | "running" | "paused"
  | "completed" | "canceled" | "failed";
export type RecipientStatus =
  | "pending" | "queued" | "sending" | "sent"
  | "delivered" | "read" | "failed" | "skipped" | "opted_out";

export interface ContactList {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  source: string | null;
  total_count: number;
  optin_count: number;
  optout_count: number;
  created_at: string;
}

export interface ContactListItem {
  id: number;
  tenant_id: number;
  list_id: number;
  phone: string;
  name: string | null;
  email: string | null;
  variables: Record<string, string>;
  opted_in: boolean;
  opted_in_at: string | null;
  opted_out: boolean;
  opted_out_at: string | null;
  opted_out_reason: string | null;
  phone_valid: boolean;
  last_message_status: string | null;
  last_message_at: string | null;
}

export interface MessageTemplate {
  id: number;
  tenant_id: number;
  name: string;
  category: "marketing" | "authentication" | "utility";
  body: string;
  media_type: "image" | "video" | "document" | null;
  media_url: string | null;
  meta_template_name: string | null;
  meta_template_status: "pending" | "approved" | "rejected" | null;
  meta_language: string;
}

export interface Campaign {
  id: number;
  tenant_id: number;
  name: string;
  provider: CampaignProvider;
  instance_id: number | null;
  list_id: number | null;
  template_id: number | null;
  custom_body: string | null;
  media_type: string | null;
  media_url: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rate_per_min: number;
  jitter_seconds: number;
  filters: { only_opted_in?: boolean; exclude_opted_out?: boolean };
  total_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  opted_out_count: number;
  auto_pause_on_block_pct: number | null;
  created_at: string;
}

export interface CampaignRecipient {
  id: number;
  campaign_id: number;
  phone: string;
  name: string | null;
  status: RecipientStatus;
  external_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  failed_reason: string | null;
  attempts: number;
}

export interface TenantCredits {
  tenant_id: number;
  balance_cents: number;
  total_purchased_cents: number;
  total_spent_cents: number;
  auto_recharge: boolean;
  auto_recharge_threshold_cents: number;
  auto_recharge_amount_cents: number;
}

export interface CreditTransaction {
  id: number;
  tenant_id: number;
  kind: "purchase" | "debit" | "refund" | "bonus" | "manual";
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  campaign_id: number | null;
  payment_provider: string | null;
  created_at: string;
}

export interface MessagePricing {
  provider: CampaignProvider;
  price_cents: number;
}

// ---------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------

export interface DashboardOverview {
  conversas_hoje: number;
  conversas_ativas: number;
  leads_total: number;
  leads_novos_semana: number;
  handoffs_pendentes: number;
  contatos_total: number;
  por_produto: { product: string; total: number }[];
  mensagens_24h: { hour: string; count: number }[];
}

export interface SuperAdminOverview {
  tenants_total: number;
  tenants_active: number;
  tenants_trial: number;
  tenants_suspended: number;
  mrr_cents: number;
  signups_last_30d: number;
  conversations_last_30d: number;
  messages_last_30d: number;
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

export interface JwtPayload {
  sub: number;
  email: string;
  role: AdminRole;
  tenant_id: number | null;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
  tenant: Tenant | null;
}

// ---------------------------------------------------------------------
// Signup público
// ---------------------------------------------------------------------

export interface SignupRequest {
  company_name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
  owner_phone?: string;
}

export interface SignupResponse {
  tenant: Tenant;
  user: AdminUser;
  token: string;
}
