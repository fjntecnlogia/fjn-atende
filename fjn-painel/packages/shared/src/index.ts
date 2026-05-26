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
