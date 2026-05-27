"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Eye, Save, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [preview, setPreview] = useState<{ body: string; vars: string }>({
    body: "",
    vars: '{"nome":"João","empresa":"FJN"}',
  });
  const [previewOut, setPreviewOut] = useState("");

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });

  useEffect(() => {
    if (editing) setPreview((p) => ({ ...p, body: editing.body }));
  }, [editing]);

  async function save() {
    if (!editing) return;
    try {
      if (editing.id) {
        await api.put(`/templates/${editing.id}`, {
          name: editing.name, body: editing.body, category: editing.category,
        });
        toast.success("Template atualizado");
      } else {
        await api.post("/templates", {
          name: editing.name, body: editing.body,
          category: editing.category ?? "marketing",
        });
        toast.success("Template criado");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["templates"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erro");
    }
  }

  async function del(id: number) {
    if (!confirm("Apagar template?")) return;
    await api.delete(`/templates/${id}`);
    toast.success("Apagado");
    qc.invalidateQueries({ queryKey: ["templates"] });
  }

  async function runPreview() {
    try {
      const vars = JSON.parse(preview.vars || "{}");
      const r = await api.post("/templates/preview", { body: preview.body, variables: vars });
      setPreviewOut(r.data.rendered);
    } catch (err: any) {
      toast.error("JSON de variáveis inválido");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/campanhas" className="text-xs text-gray2 hover:text-orange flex items-center gap-1">
            <ArrowLeft size={12} /> Campanhas
          </Link>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3 mt-1">
            <FileText className="text-orange" />
            Templates
          </h1>
          <p className="text-sm text-gray2 mt-1">Mensagens reutilizáveis com variáveis</p>
        </div>
        <button onClick={() => setEditing({ name: "", body: "", category: "marketing" })}
                className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Novo template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-display font-bold">{editing.id ? "Editar template" : "Novo template"}</h3>
            <div>
              <label className="label">Nome</label>
              <input className="input w-full mt-1" placeholder="Ex: Cobrança mensal"
                     value={editing.name}
                     onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input w-full mt-1" value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                <option value="marketing">Marketing</option>
                <option value="utility">Utility (transacional)</option>
                <option value="authentication">Authentication (OTP)</option>
              </select>
            </div>
            <div>
              <label className="label">Corpo da mensagem</label>
              <textarea className="input w-full mt-1 font-mono text-sm" rows={10}
                        placeholder="Olá {{nome|capitalize}}!&#10;Seu boleto da {{empresa}} vence amanhã.&#10;&#10;Total: R$ {{valor}}"
                        value={editing.body}
                        onChange={(e) => {
                          setEditing({ ...editing, body: e.target.value });
                          setPreview((p) => ({ ...p, body: e.target.value }));
                        }} />
              <p className="text-[10px] text-gray2 mt-1">
                Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{empresa}}"}</code>...<br />
                Modificadores: <code>{"{{nome|upper}}"}</code>, <code>{"{{nome|capitalize}}"}</code>, <code>{"{{nome|first}}"}</code>, <code>{"{{nome|fallback}}"}</code>
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">Cancelar</button>
              <button onClick={save} className="btn-primary flex items-center gap-2">
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="card p-5 space-y-3">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Eye size={14} className="text-orange" /> Preview
            </h3>
            <div>
              <label className="label">Variáveis (JSON pra teste)</label>
              <textarea className="input w-full mt-1 font-mono text-xs" rows={3}
                        value={preview.vars}
                        onChange={(e) => setPreview({ ...preview, vars: e.target.value })} />
              <button onClick={runPreview} className="btn-ghost mt-2 flex items-center gap-1 text-xs">
                <Eye size={12} /> Renderizar
              </button>
            </div>
            <div>
              <label className="label">Resultado</label>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-1
                              font-mono text-sm whitespace-pre-wrap min-h-[100px]">
                {previewOut || <span className="text-gray2">clique em "Renderizar"...</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card p-4 group hover:border-orange/40 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-display font-bold text-light truncate flex-1">{t.name}</h3>
              <button onClick={() => del(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray2 hover:text-red-400 p-1">
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-orange/80 mb-2">{t.category}</p>
            <p className="text-xs text-light/70 line-clamp-3 font-mono whitespace-pre-wrap">{t.body}</p>
            <button onClick={() => setEditing(t)} className="btn-ghost text-xs mt-3 w-full">Editar</button>
          </div>
        ))}
        {templates.length === 0 && !editing && (
          <div className="col-span-full card p-12 text-center">
            <FileText className="mx-auto mb-3 text-gray2/50" size={32} />
            <p className="text-gray2 text-sm">Nenhum template criado</p>
          </div>
        )}
      </div>
    </div>
  );
}
