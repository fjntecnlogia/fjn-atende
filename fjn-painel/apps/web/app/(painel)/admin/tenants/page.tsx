"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/utils";

interface TenantRow {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  users_count: number;
}

const planColors: Record<string, string> = {
  trial:      "bg-orange/15 text-orange border-orange/30",
  starter:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pro:        "bg-purple-500/15 text-purple-400 border-purple-500/30",
  enterprise: "bg-green-500/15 text-green-400 border-green-500/30",
};

export default function TenantsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended" | "canceled">("all");
  const [plan, setPlan] = useState("");

  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ["tenants-list", search, status, plan],
    queryFn: async () => (await api.get("/tenants", {
      params: { search: search || undefined, status, plan: plan || undefined },
    })).data,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Building2 className="text-orange" />
          Tenants
        </h1>
        <p className="text-sm text-gray2 mt-1">{tenants.length} contas no FJN Atende</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray2" />
          <input className="input w-full pl-9 text-sm" placeholder="Buscar nome, slug, e-mail..."
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input text-sm">
          <option value="all">Todos status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
          <option value="canceled">Cancelados</option>
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input text-sm">
          <option value="">Todos os planos</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              {["Empresa", "Slug", "Plano", "Status", "Usuários", "Cadastrado", ""].map((h) => (
                <th key={h} className="text-left p-3 label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-border/40 hover:bg-white/3">
                <td className="p-3">
                  <p className="font-semibold text-light">{t.name}</p>
                  <p className="text-xs text-gray2">{t.email ?? "—"}</p>
                </td>
                <td className="p-3 text-gray2 font-mono text-xs">{t.slug}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full ${planColors[t.plan] ?? planColors.trial}`}>
                    {t.plan}
                  </span>
                </td>
                <td className="p-3"><Badge variant={t.status === "active" ? "active" : t.status === "suspended" ? "paused" : "closed"}>{t.status}</Badge></td>
                <td className="p-3 text-gray2">{t.users_count}</td>
                <td className="p-3 text-xs text-gray2">{relativeTime(t.created_at)}</td>
                <td className="p-3">
                  <Link href={`/admin/tenants/${t.id}`} className="text-xs text-orange hover:underline">
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray2 text-sm">Nenhum tenant encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
