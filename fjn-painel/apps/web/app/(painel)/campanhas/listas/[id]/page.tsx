"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, UserPlus, Download, ArrowLeft, Search, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { maskPhone } from "@/lib/utils";

export default function ListaDetalhePage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importDays, setImportDays] = useState(90);
  const [manualPhones, setManualPhones] = useState("");

  const { data, refetch } = useQuery<any>({
    queryKey: ["contact-list", id, search],
    queryFn: async () => (await api.get(`/contact-lists/${id}?search=${encodeURIComponent(search)}`)).data,
    refetchInterval: 15_000,
  });

  const list = data?.list;
  const items = data?.items ?? [];

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const t = toast.loading("Enviando CSV...");
    try {
      const r = await api.post(`/contact-lists/${id}/import-csv`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `${r.data.inserted} contatos importados (${r.data.skipped} ignorados de ${r.data.total_in_csv} total)`,
        { id: t },
      );
      refetch(); qc.invalidateQueries({ queryKey: ["contact-lists"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha no upload", { id: t });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function importFromAtendimento() {
    const t = toast.loading("Importando contatos do atendimento...");
    try {
      const r = await api.post(`/contact-lists/${id}/import-from-atendimento`, { since_days: importDays });
      toast.success(`${r.data.imported} contatos importados como opt-in`, { id: t });
      setShowImport(false);
      refetch(); qc.invalidateQueries({ queryKey: ["contact-lists"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro", { id: t });
    }
  }

  async function addManual() {
    const phones = manualPhones.split("\n").map((p) => p.trim()).filter((p) => p);
    if (phones.length === 0) return;
    const items = phones.map((p) => {
      const [phone, name] = p.split(",").map((s) => s.trim());
      return { phone, name: name || undefined, opted_in: true };
    });
    try {
      const r = await api.post(`/contact-lists/${id}/items`, { items });
      toast.success(`${r.data.inserted} adicionados (${r.data.skipped} ignorados)`);
      setManualPhones(""); setShowManual(false);
      refetch(); qc.invalidateQueries({ queryKey: ["contact-lists"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  if (!list) return <div className="p-8 text-gray2">Carregando...</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link href="/campanhas/listas" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
          <ArrowLeft size={12} /> Listas
        </Link>
        <h1 className="font-display text-3xl font-extrabold mt-1">{list.name}</h1>
        {list.description && <p className="text-sm text-gray2 mt-1">{list.description}</p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiBox label="Total" value={list.total_count} color="text-light" />
        <KpiBox label="Opt-in" value={list.optin_count} color="text-green-400" />
        <KpiBox label="Opt-out" value={list.optout_count} color="text-orange" />
      </div>

      {/* Ações */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3">Adicionar contatos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Upload CSV */}
          <button onClick={() => fileRef.current?.click()}
                  className="card p-4 hover:border-orange/40 transition-colors text-left group">
            <Upload className="text-orange mb-2" size={20} />
            <p className="font-semibold text-sm">Upload CSV</p>
            <p className="text-xs text-gray2 mt-1">Arquivo .csv com colunas <code>phone,name</code> + extras viram variáveis</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </button>

          {/* Importar atendimento */}
          <button onClick={() => setShowImport(true)}
                  className="card p-4 hover:border-orange/40 transition-colors text-left">
            <Download className="text-orange mb-2" size={20} />
            <p className="font-semibold text-sm">Importar do Atendimento</p>
            <p className="text-xs text-gray2 mt-1">Contatos que já conversaram (já são opt-in)</p>
          </button>

          {/* Adicionar manual */}
          <button onClick={() => setShowManual(true)}
                  className="card p-4 hover:border-orange/40 transition-colors text-left">
            <UserPlus className="text-orange mb-2" size={20} />
            <p className="font-semibold text-sm">Adicionar manual</p>
            <p className="text-xs text-gray2 mt-1">Cola lista de números (um por linha)</p>
          </button>
        </div>
      </div>

      {/* Modal: importar do atendimento */}
      {showImport && (
        <div className="card p-5 border-orange/30 bg-orange/5">
          <h3 className="font-display font-bold mb-3">Importar do Atendimento</h3>
          <p className="text-xs text-gray2 mb-3">
            Vai importar contatos que conversaram com você nos últimos N dias. Eles entram como <strong>opt-in</strong> (já consentiram).
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">Últimos quantos dias?</label>
              <input type="number" min={1} max={3650} className="input w-full mt-1"
                     value={importDays} onChange={(e) => setImportDays(Number(e.target.value))} />
            </div>
            <button onClick={() => setShowImport(false)} className="btn-ghost">Cancelar</button>
            <button onClick={importFromAtendimento} className="btn-primary">Importar</button>
          </div>
        </div>
      )}

      {/* Modal: manual */}
      {showManual && (
        <div className="card p-5 border-orange/30 bg-orange/5">
          <h3 className="font-display font-bold mb-3">Adicionar manualmente</h3>
          <p className="text-xs text-gray2 mb-3">Um contato por linha. Formato: <code>telefone,nome</code> (nome opcional)</p>
          <textarea className="input w-full font-mono text-sm" rows={8}
                    placeholder="5511999998888,João Silva&#10;5511888887777,Maria&#10;65980900089"
                    value={manualPhones} onChange={(e) => setManualPhones(e.target.value)} />
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowManual(false)} className="btn-ghost">Cancelar</button>
            <button onClick={addManual} className="btn-primary">Adicionar</button>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray2" />
        <input className="input w-full pl-9 text-sm" placeholder="Buscar nome ou telefone..."
               value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Lista de itens */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy2/50">
            <tr>
              <th className="text-left p-3 label">Telefone</th>
              <th className="text-left p-3 label">Nome</th>
              <th className="text-left p-3 label">E-mail</th>
              <th className="text-left p-3 label">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i: any) => (
              <tr key={i.id} className="border-t border-border/40">
                <td className="p-3 font-mono text-xs">{maskPhone(i.phone)}</td>
                <td className="p-3">{i.name ?? "—"}</td>
                <td className="p-3 text-xs text-gray2">{i.email ?? "—"}</td>
                <td className="p-3">
                  {i.opted_out ? (
                    <Badge variant="closed">opt-out</Badge>
                  ) : i.opted_in ? (
                    <Badge variant="resolved">opt-in</Badge>
                  ) : (
                    <Badge>sem opt-in</Badge>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray2 text-sm">Nenhum contato</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray2">{label}</p>
      <p className={`font-display font-extrabold text-3xl ${color} mt-1`}>{value}</p>
    </div>
  );
}
