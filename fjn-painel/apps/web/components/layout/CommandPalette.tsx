"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, LayoutDashboard, MessageSquare, Kanban, Users, UsersRound,
  AlertTriangle, Smartphone, Settings, Megaphone, Wallet, CreditCard,
  Palette, HelpCircle, DollarSign, Activity, Sparkles, Crown, Building2,
  BookOpen, ArrowRight,
} from "lucide-react";
import { ARTICLES } from "@/app/(painel)/ajuda/_data/articles";

interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: any;
  section: "Navegação" | "Ajuda" | "Ações";
  keywords: string[];  // termos extras pra busca
}

const NAV_COMMANDS: Command[] = [
  { id: "dashboard", label: "Dashboard", hint: "Visão geral", href: "/dashboard", icon: LayoutDashboard, section: "Navegação", keywords: ["home", "inicio"] },
  { id: "conversas", label: "Conversas", hint: "Mensagens WhatsApp", href: "/conversas", icon: MessageSquare, section: "Navegação", keywords: ["chat", "mensagens", "whats"] },
  { id: "funis", label: "Funis", hint: "Kanban de vendas", href: "/funis", icon: Kanban, section: "Navegação", keywords: ["pipeline", "kanban", "crm"] },
  { id: "times", label: "Times", hint: "Grupos de atendentes", href: "/times", icon: Users, section: "Navegação", keywords: ["equipe", "atendentes"] },
  { id: "leads", label: "Leads", hint: "Contatos capturados", href: "/leads", icon: UsersRound, section: "Navegação", keywords: ["contatos", "prospects"] },
  { id: "handoffs", label: "Handoffs", hint: "Transferências IA→humano", href: "/handoffs", icon: AlertTriangle, section: "Navegação", keywords: ["transferir"] },
  { id: "whatsapp", label: "WhatsApp", hint: "Instâncias conectadas", href: "/whatsapp", icon: Smartphone, section: "Navegação", keywords: ["qr", "conectar"] },
  { id: "campanhas", label: "Campanhas", hint: "Disparo em massa", href: "/campanhas", icon: Megaphone, section: "Navegação", keywords: ["disparo", "marketing"] },
  { id: "creditos", label: "Créditos", hint: "Saldo pré-pago", href: "/creditos", icon: Wallet, section: "Navegação", keywords: ["saldo", "recarga"] },
  { id: "plano", label: "Meu plano", hint: "Assinatura Pro/Pro+", href: "/configuracoes/plano", icon: CreditCard, section: "Navegação", keywords: ["assinatura", "billing"] },
  { id: "branding", label: "Branding", hint: "Logo e cores personalizados", href: "/configuracoes/branding", icon: Palette, section: "Navegação", keywords: ["marca", "cor", "logo"] },
  { id: "config-ia", label: "Config IA", hint: "Persona e dossiês", href: "/config", icon: Settings, section: "Navegação", keywords: ["ia", "prompt", "persona", "bot"] },
  { id: "ajuda", label: "Ajuda", hint: "Tutoriais e dúvidas", href: "/ajuda", icon: HelpCircle, section: "Navegação", keywords: ["docs", "tutorial", "suporte"] },
];

const ADMIN_COMMANDS: Command[] = [
  { id: "admin", label: "Super Admin: Visão Geral", href: "/admin", icon: Crown, section: "Navegação", keywords: ["admin"] },
  { id: "admin-dashboard", label: "Super Admin: Dashboard", hint: "MRR, ARR, churn", href: "/admin/dashboard", icon: Sparkles, section: "Navegação", keywords: ["mrr", "arr", "grafico"] },
  { id: "admin-billing", label: "Super Admin: Billing", hint: "Assinantes e receita", href: "/admin/billing", icon: DollarSign, section: "Navegação", keywords: ["stripe", "receita"] },
  { id: "admin-usage", label: "Super Admin: Consumo", hint: "Ranking uso IA", href: "/admin/usage", icon: Activity, section: "Navegação", keywords: ["uso", "consumo"] },
  { id: "admin-tenants", label: "Super Admin: Assinantes", hint: "Todas as contas", href: "/admin/tenants", icon: Building2, section: "Navegação", keywords: ["contas", "clientes", "tenants", "assinantes"] },
  { id: "admin-planos", label: "Super Admin: Planos", hint: "Editar catálogo", href: "/admin/planos", icon: CreditCard, section: "Navegação", keywords: ["planos"] },
];

export function CommandPalette({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Comandos: nav (todos) + admin (só se super) + artigos da Ajuda
  const allCommands = useMemo(() => {
    const nav = [...NAV_COMMANDS];
    if (isSuperAdmin) nav.push(...ADMIN_COMMANDS);
    const articles: Command[] = ARTICLES.map((a) => ({
      id: `art-${a.slug}`,
      label: a.title,
      hint: a.description,
      href: `/ajuda/${a.slug}`,
      icon: BookOpen,
      section: "Ajuda" as const,
      keywords: [a.category],
    }));
    return [...nav, ...articles];
  }, [isSuperAdmin]);

  // Filtragem
  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, 20);
    const q = query.toLowerCase();
    return allCommands.filter((c) =>
      c.label.toLowerCase().includes(q)
      || c.hint?.toLowerCase().includes(q)
      || c.keywords.some((k) => k.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [query, allCommands]);

  // Atalho global Ctrl+K / Cmd+K pra abrir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = filtered[selectedIndex];
        if (chosen) navigate(chosen.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selectedIndex]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  // Agrupa por section
  const grouped: Record<string, Command[]> = {};
  filtered.forEach((c) => {
    if (!grouped[c.section]) grouped[c.section] = [];
    grouped[c.section].push(c);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-navy/80 backdrop-blur-sm p-4"
         onClick={() => setOpen(false)}>
      <div className="bg-navy2 rounded-xl border border-border shadow-2xl w-full max-w-xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        {/* Header com busca */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search size={18} className="text-orange" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-light text-sm outline-none placeholder:text-gray2"
            placeholder="Buscar telas, artigos, ações... (Ctrl+K)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="text-[10px] text-gray2 border border-border px-1.5 py-0.5 rounded">ESC</kbd>
          <button onClick={() => setOpen(false)} className="text-gray2 hover:text-light">
            <X size={16} />
          </button>
        </div>

        {/* Lista resultados */}
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray2 text-sm">
              Nada encontrado pra <strong className="text-light">"{query}"</strong>
            </div>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-gray2/60">
                  {section}
                </p>
                {items.map((c, idx) => {
                  const globalIdx = filtered.indexOf(c);
                  const active = globalIdx === selectedIndex;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      onClick={() => navigate(c.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active ? "bg-orange/10" : "hover:bg-white/3"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-orange" : "text-gray2"} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${active ? "text-orange font-semibold" : "text-light"}`}>
                          {c.label}
                        </p>
                        {c.hint && (
                          <p className="text-[11px] text-gray2 truncate">{c.hint}</p>
                        )}
                      </div>
                      {active && <ArrowRight size={12} className="text-orange" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-navy3 text-[10px] text-gray2">
          <span>
            <kbd className="border border-border px-1 rounded">↑↓</kbd> navegar ·
            <kbd className="border border-border px-1 rounded ml-1">Enter</kbd> abrir ·
            <kbd className="border border-border px-1 rounded ml-1">Esc</kbd> fechar
          </span>
          <span>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
