"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, UsersRound, AlertTriangle,
  Settings, LogOut, Smartphone, Crown, Building2, LogIn,
  Megaphone, Wallet, Kanban, Users, CreditCard, Palette, DollarSign, HelpCircle, Activity,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTenantBranding } from "@/app/providers";
import { cn } from "@/lib/utils";

const tenantNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversas", label: "Conversas", icon: MessageSquare },
  { href: "/funis",     label: "Funis",     icon: Kanban },
  { href: "/times",     label: "Times",     icon: Users },
  { href: "/leads",     label: "Leads",     icon: UsersRound },
  { href: "/handoffs",  label: "Handoffs",  icon: AlertTriangle },
  { href: "/whatsapp",  label: "WhatsApp",  icon: Smartphone },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone, group: "disparo" },
  { href: "/creditos",  label: "Créditos",  icon: Wallet,    group: "disparo" },
  { href: "/configuracoes/plano",    label: "Plano",    icon: CreditCard },
  { href: "/configuracoes/branding", label: "Branding", icon: Palette },
  { href: "/config",    label: "Config IA", icon: Settings },
  { href: "/ajuda",     label: "Ajuda",     icon: HelpCircle },
];

const superAdminNav = [
  { href: "/admin",           label: "Visão Geral", icon: Crown },
  { href: "/admin/dashboard", label: "Dashboard",   icon: Sparkles },
  { href: "/admin/billing",   label: "Billing",     icon: DollarSign },
  { href: "/admin/usage",     label: "Consumo",     icon: Activity },
  { href: "/admin/tenants",   label: "Tenants",     icon: Building2 },
  { href: "/admin/planos",    label: "Planos",      icon: CreditCard },
];

export function Sidebar({ realtimeConnected = false }: { realtimeConnected?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, activeTenantId, logout, setActiveTenant } = useAuth();
  const tenantBranding = useTenantBranding();
  const isSuperAdmin = user?.role === "super_admin";

  // Branding ativo: tenant detectado pelo host (white-label) ou padrão FJN
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
      <div className="h-16 flex items-center px-6 border-b border-border">
        {brandLogo ? (
          <div className="flex items-center gap-2">
            <img src={brandLogo} alt={brandName ?? "Logo"}
                 className="h-8 w-auto max-w-[150px] object-contain" />
          </div>
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

      {/* Indicador de impersonation pra super-admin */}
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

      <nav className="flex-1 py-4 flex flex-col gap-0.5">
        {/* Itens de tenant (visíveis quando tenant ativo OU role normal) */}
        {(activeTenantId || !isSuperAdmin) && tenantNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn("flex items-center gap-3 px-6 py-2.5 text-sm transition-all border-r-2",
                active ? "text-orange bg-orange/5 border-orange" : "text-light/60 hover:text-light hover:bg-white/3 border-transparent")}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {isSuperAdmin && (
          <>
            <div className="px-6 mt-4 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-gray2 font-bold">Super Admin</p>
            </div>
            {superAdminNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              return (
                <Link key={href} href={href}
                  className={cn("flex items-center gap-3 px-6 py-2.5 text-sm transition-all border-r-2",
                    active ? "text-orange bg-orange/5 border-orange" : "text-light/60 hover:text-light hover:bg-white/3 border-transparent")}>
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

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
