"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, UsersRound, AlertTriangle,
  Settings, LogOut, Smartphone, Crown, Building2,
  Megaphone, Wallet, Kanban, Users, CreditCard, Palette, DollarSign, HelpCircle, Activity,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTenantBranding } from "@/app/providers";
import { cn } from "@/lib/utils";

// =====================================================================
// Navegação agrupada — cada grupo tem título + itens com descrição
// =====================================================================
interface NavItem {
  href: string;
  label: string;
  icon: any;
  desc: string;  // aparece no tooltip pra explicar o que faz
  isNew?: boolean;  // mostra badge "NOVO" laranja
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const tenantGroups: NavGroup[] = [
  {
    title: "Painel",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard,
        desc: "Visão geral de conversas, leads e métricas do dia" },
      { href: "/conversas", label: "Conversas", icon: MessageSquare,
        desc: "Todas as mensagens do WhatsApp em tempo real" },
    ],
  },
  {
    title: "CRM & Funil",
    items: [
      { href: "/funis",    label: "Funis",    icon: Kanban,
        desc: "Kanban visual das oportunidades de venda", isNew: true },
      { href: "/times",    label: "Times",    icon: Users,
        desc: "Grupos de atendentes com distribuição automática", isNew: true },
      { href: "/leads",    label: "Leads",    icon: UsersRound,
        desc: "Contatos capturados pela IA com interesse comercial" },
      { href: "/handoffs", label: "Handoffs", icon: AlertTriangle,
        desc: "Conversas transferidas da IA pra atendente humano" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/whatsapp", label: "WhatsApp",  icon: Smartphone,
        desc: "Conectar e gerenciar instâncias do WhatsApp Business" },
      { href: "/config",   label: "Config IA", icon: Settings,
        desc: "Personalize persona, produtos e regras da IA" },
    ],
  },
  {
    title: "Campanhas",
    items: [
      { href: "/campanhas", label: "Campanhas", icon: Megaphone,
        desc: "Disparo em massa via WhatsApp com anti-ban" },
      { href: "/creditos",  label: "Créditos",  icon: Wallet,
        desc: "Recarga pré-paga pra IA e campanhas extras" },
    ],
  },
  {
    title: "Conta",
    items: [
      { href: "/configuracoes/plano",    label: "Plano",    icon: CreditCard,
        desc: "Ver e alterar sua assinatura Pro/Pro+", isNew: true },
      { href: "/configuracoes/branding", label: "Branding", icon: Palette,
        desc: "Personalize logo, cores e marca (Pro+)", isNew: true },
    ],
  },
  {
    title: "Suporte",
    items: [
      { href: "/ajuda", label: "Ajuda", icon: HelpCircle,
        desc: "Tutoriais, dúvidas e cases de uso", isNew: true },
    ],
  },
];

const superAdminNav: NavItem[] = [
  { href: "/admin",           label: "Visão Geral", icon: Crown,
    desc: "Métricas gerais da plataforma" },
  { href: "/admin/dashboard", label: "Dashboard",   icon: Sparkles,
    desc: "Gráficos executivos: MRR, ARR, churn, conversão", isNew: true },
  { href: "/admin/billing",   label: "Billing",     icon: DollarSign,
    desc: "Assinantes, receita e eventos do Stripe", isNew: true },
  { href: "/admin/usage",     label: "Consumo",     icon: Activity,
    desc: "Ranking de tenants por consumo de IA", isNew: true },
  { href: "/admin/tenants",   label: "Assinantes",  icon: Building2,
    desc: "Todas as contas cadastradas + impersonation" },
  { href: "/admin/planos",    label: "Planos",      icon: CreditCard,
    desc: "Editar preços, limites e features dos planos" },
];

export function Sidebar({ realtimeConnected = false }: { realtimeConnected?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, activeTenantId, logout, setActiveTenant } = useAuth();
  const tenantBranding = useTenantBranding();
  const isSuperAdmin = user?.role === "super_admin";

  const brandLogo = tenantBranding?.branding?.logo_url;
  const brandName = tenantBranding?.branding?.company_name_override ?? tenantBranding?.name;
  const hideFJN = tenantBranding?.hide_fjn_branding;

  function handleLogout() {
    logout();
    localStorage.removeItem("fjn_token");
    router.push("/login");
  }

  function exitImpersonation() {
    setActiveTenant(null);
    router.push("/admin");
  }

  return (
    <aside className="w-[240px] min-h-screen bg-navy2 border-r border-border flex flex-col">
      {/* Logo/Header */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        {brandLogo ? (
          <img src={brandLogo} alt={brandName ?? "Logo"}
               className="h-8 w-auto max-w-[150px] object-contain" />
        ) : hideFJN && brandName ? (
          <div className="font-display font-extrabold tracking-tight text-lg leading-none text-light">
            {brandName}
          </div>
        ) : (
          <div className="font-display font-extrabold tracking-tight text-lg leading-none">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </div>
        )}
      </div>

      {/* Impersonation banner */}
      {isSuperAdmin && activeTenantId && tenant && (
        <div className="bg-orange/10 border-b border-orange/30 px-4 py-2">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold">Visualizando como</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-light font-semibold truncate">{tenant.name}</p>
            <button onClick={exitImpersonation}
                    className="text-[10px] text-orange hover:underline whitespace-nowrap ml-2">
              sair
            </button>
          </div>
        </div>
      )}

      {/* Navegação agrupada */}
      <nav className="flex-1 py-3 flex flex-col overflow-y-auto">
        {(activeTenantId || !isSuperAdmin) && tenantGroups.map((group) => (
          <NavSection key={group.title} title={group.title} items={group.items} pathname={pathname} />
        ))}

        {isSuperAdmin && (
          <NavSection title="Super Admin" items={superAdminNav} pathname={pathname} highlight />
        )}
      </nav>

      {/* Footer com user + logout */}
      <div className="border-t border-border p-4">
        {user && (
          <div className="mb-3 px-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-light truncate">{user.name}</p>
              <span
                title={realtimeConnected ? "Tempo real conectado" : "Tempo real desconectado"}
                className={cn("w-2 h-2 rounded-full", realtimeConnected ? "bg-green-400" : "bg-gray2/40")}
              />
            </div>
            <p className="text-xs text-gray2 truncate">{user.email}</p>
            {isSuperAdmin && (
              <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest text-orange bg-orange/10 border border-orange/30 px-2 py-0.5 rounded-full">
                SUPER ADMIN
              </span>
            )}
          </div>
        )}
        <button onClick={handleLogout}
                className="flex items-center gap-3 text-sm text-light/60 hover:text-orange transition-colors w-full px-1 py-2">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}

// =====================================================================
// Seção do menu (título + lista de itens com tooltip)
// =====================================================================
function NavSection({
  title, items, pathname, highlight,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  highlight?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className={cn(
        "px-6 mb-1 text-[10px] uppercase tracking-widest font-bold",
        highlight ? "text-orange mt-4" : "text-gray2/60"
      )}>
        {title}
      </p>
      <ul>
        {items.map(({ href, label, icon: Icon, desc, isNew }) => {
          const active = pathname === href
            || (href !== "/admin" && pathname.startsWith(href + "/"));
          return (
            <li key={href}>
              <Link href={href}
                title={desc}
                className={cn(
                  "flex items-center gap-3 px-6 py-2 text-sm transition-all border-r-2 group",
                  active
                    ? "text-orange bg-orange/5 border-orange"
                    : "text-light/60 hover:text-light hover:bg-white/3 border-transparent"
                )}>
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {isNew && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange/20 text-orange border border-orange/40 uppercase tracking-widest">
                    Novo
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
