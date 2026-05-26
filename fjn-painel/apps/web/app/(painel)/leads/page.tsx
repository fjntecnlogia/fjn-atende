"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { maskPhone, relativeTime } from "@/lib/utils";
import type { Lead } from "@fjn-painel/shared";

const STAGES = ["novo", "qualificado", "negociando", "ganho", "perdido"];

export default function LeadsPage() {
  const qc = useQueryClient();
  const [filterProduct, setFilterProduct] = useState("");

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads", { filterProduct }],
    queryFn: async () =>
      (await api.get("/leads", { params: { product: filterProduct || undefined } })).data,
    refetchInterval: 20_000,
  });

  async function changeStage(id: number, stage: string) {
    await api.patch(`/leads/${id}`, { stage });
    toast.success("Estágio atualizado");
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <UsersRound className="text-orange" />
            Leads
          </h1>
          <p className="text-sm text-gray2 mt-1">{leads.length} leads capturados</p>
        </div>
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="input text-sm"
        >
          <option value="">Todos os produtos</option>
          <option value="stylogestor">STYLOGESTOR</option>
          <option value="gymflow">GYMFLOW</option>
          <option value="fjn-dev">FJN Dev</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              {["Contato", "Telefone", "Produto", "Estágio", "Notas", "Criado"].map((h) => (
                <th key={h} className="text-left p-3 label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-border/40 hover:bg-white/3">
                <td className="p-3 font-medium">{l.contact_name ?? "—"}</td>
                <td className="p-3 text-gray2 text-xs">{maskPhone(l.contact_phone)}</td>
                <td className="p-3">
                  <Badge>{l.product}</Badge>
                </td>
                <td className="p-3">
                  <select
                    value={l.stage}
                    onChange={(e) => changeStage(l.id, e.target.value)}
                    className="bg-navy2 border border-border rounded px-2 py-1 text-xs"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-xs text-light/70 max-w-xs truncate">{l.notes ?? "—"}</td>
                <td className="p-3 text-xs text-gray2">{relativeTime(l.created_at)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray2 text-sm">
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
