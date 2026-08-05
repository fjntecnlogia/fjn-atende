"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, FileText, Bot, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/layout/PageIntro";

interface Persona {
  ai_persona?: { name?: string; tone?: string; rules?: string[] };
  prompt_master?: string | null;
}
interface KnowledgeItem {
  id: number; key: string; title: string; content: string;
  enabled: boolean; position: number; updated_at: string;
}

export default function ConfigPage() {
  const [tab, setTab] = useState<"persona" | "knowledge">("persona");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Bot className="text-orange" />
          Configuração da IA
        </h1>
        <p className="text-sm text-gray2 mt-1">Personalize a persona e os conhecimentos da IA atendente</p>
      </div>

      <PageIntro
        storageKey="config-ia-intro"
        title="Ensine a IA a atender como sua empresa atenderia"
        description="Aqui você define quem a IA é (persona) e o que ela sabe (dossiês). Quanto mais específico, melhor o atendimento — evite prompts genéricos tipo 'atendente educada'."
        steps={[
          "Persona: nome, tom de voz, regras (ex: 'Nunca prometer prazo menor que 5 dias')",
          "Prompt master: contexto adicional que vai em toda conversa (produtos, preços, políticas)",
          "Dossiês: blocos de conhecimento que a IA consulta (ex: FAQ, tabela de preços, procedimentos)",
          "Teste manda mensagem pro seu próprio número de outro celular pra validar",
        ]}
        helpArticle={{ slug: "configurar-persona-ia", label: "Guia de configuração da IA" }}
      />

      <div className="flex gap-2 border-b border-border">
        <TabBtn active={tab === "persona"}   onClick={() => setTab("persona")}>Persona & Prompt</TabBtn>
        <TabBtn active={tab === "knowledge"} onClick={() => setTab("knowledge")}>Dossiês</TabBtn>
      </div>

      {tab === "persona" && <PersonaTab />}
      {tab === "knowledge" && <KnowledgeTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick}
      className={cn("px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
        active ? "text-orange border-orange" : "text-gray2 border-transparent hover:text-light")}>
      {children}
    </button>
  );
}

// -----------------------------------------------------------------
function PersonaTab() {
  const qc = useQueryClient();
  const { data: persona } = useQuery<Persona>({
    queryKey: ["persona"],
    queryFn: async () => (await api.get("/config/persona")).data,
  });

  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (persona) {
      setName(persona.ai_persona?.name ?? "");
      setTone(persona.ai_persona?.tone ?? "");
      setPrompt(persona.prompt_master ?? "");
    }
  }, [persona]);

  async function save() {
    await api.put("/config/persona", {
      ai_persona: { name, tone },
      prompt_master: prompt || null,
    });
    toast.success("Persona salva");
    qc.invalidateQueries({ queryKey: ["persona"] });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card p-6 lg:col-span-1 space-y-4">
        <h3 className="font-semibold text-light">Identidade</h3>
        <div>
          <label className="label block mb-1">Nome da atendente</label>
          <input className="input w-full" placeholder="Ex: Ana, Carlos, Sofia"
                 value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-gray2 mt-1">Como ela vai se apresentar pros clientes</p>
        </div>
        <div>
          <label className="label block mb-1">Tom de voz</label>
          <input className="input w-full" placeholder="Ex: caloroso e direto"
                 value={tone} onChange={(e) => setTone(e.target.value)} />
        </div>
        <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={14} /> Salvar identidade
        </button>
      </div>

      <div className="card p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-light">Prompt Master (avançado)</h3>
          <button onClick={save} className="btn-primary text-sm py-1.5 flex items-center gap-1">
            <Save size={12} /> Salvar
          </button>
        </div>
        <p className="text-xs text-gray2">
          Sobrescreve o prompt padrão da IA. Deixe vazio pra usar o padrão (recomendado pra começar).
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Deixe vazio pra usar o prompt padrão do FJN Atende..."
          className="w-full bg-navy2 border border-border rounded-lg p-4 font-mono text-sm text-light/95 resize-none focus:outline-none focus:border-orange"
          style={{ height: "calc(100vh - 380px)", minHeight: 400 }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
function KnowledgeTab() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery<KnowledgeItem[]>({
    queryKey: ["knowledge"],
    queryFn: async () => (await api.get("/config/knowledge")).data,
  });

  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggle(item: KnowledgeItem) {
    await api.put(`/config/knowledge/${item.id}`, { enabled: !item.enabled });
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  }

  async function remove(id: number) {
    if (!confirm("Apagar este dossiê?")) return;
    await api.delete(`/config/knowledge/${id}`);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["knowledge"] });
    setEditing(null);
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 space-y-2">
        <button onClick={() => { setCreating(true); setEditing(null); }}
                className="btn-primary w-full flex items-center justify-center gap-2">
          <Plus size={14} /> Novo dossiê
        </button>
        {items.map((it) => (
          <button key={it.id}
            onClick={() => { setEditing(it); setCreating(false); }}
            className={cn("w-full text-left p-3 rounded-lg border transition-colors",
              editing?.id === it.id ? "bg-orange/10 border-orange/40" : "border-border hover:bg-white/3")}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-light">{it.title}</p>
              {!it.enabled && <EyeOff size={12} className="text-gray2" />}
            </div>
            <p className="text-[10px] text-gray2 mt-1 font-mono">{it.key}</p>
          </button>
        ))}
        {items.length === 0 && !creating && (
          <p className="text-xs text-gray2 text-center py-6">Nenhum dossiê ainda</p>
        )}
      </div>
      <div className="col-span-8">
        {(editing || creating) ? (
          <KnowledgeEditor
            item={editing}
            isCreating={creating}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["knowledge"] });
              setCreating(false);
            }}
            onDelete={() => editing && remove(editing.id)}
            onCancel={() => { setEditing(null); setCreating(false); }}
            onToggle={() => editing && toggle(editing)}
          />
        ) : (
          <div className="card p-8 text-center">
            <FileText size={32} className="text-gray2 mx-auto mb-3" />
            <p className="text-gray2 text-sm">Selecione um dossiê pra editar ou crie um novo</p>
            <p className="text-xs text-gray2 mt-3 max-w-md mx-auto">
              Dossiês são informações sobre seus produtos/serviços que a IA usa pra atender clientes.
              Ex: "Plano Pro", "FAQ", "Política de cancelamento", "Catálogo".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeEditor({ item, isCreating, onSaved, onCancel, onDelete, onToggle }: any) {
  const [key, setKey] = useState(item?.key ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setKey(item?.key ?? "");
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
  }, [item]);

  async function save() {
    setSaving(true);
    try {
      if (isCreating) {
        await api.post("/config/knowledge", { key, title, content });
        toast.success("Dossiê criado");
      } else {
        await api.put(`/config/knowledge/${item.id}`, { title, content });
        toast.success("Salvo");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        {isCreating && (
          <input className="input flex-1" placeholder="key-unica (ex: plano-pro)"
                 value={key} onChange={(e) => setKey(e.target.value)} />
        )}
        <input className="input flex-1" placeholder="Título visível"
               value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva tudo que a IA precisa saber sobre esse tópico..."
        className="w-full bg-navy2 border border-border rounded-lg p-4 text-sm text-light/95 resize-none focus:outline-none focus:border-orange"
        style={{ height: "calc(100vh - 380px)", minHeight: 400 }} />
      <div className="flex justify-between gap-2">
        <button onClick={onCancel} className="btn-ghost">Cancelar</button>
        <div className="flex gap-2">
          {!isCreating && (
            <>
              <button onClick={onToggle} className="btn-ghost text-xs flex items-center gap-1">
                {item?.enabled ? <><EyeOff size={12} /> Desativar</> : <><Eye size={12} /> Ativar</>}
              </button>
              <button onClick={onDelete} className="btn-ghost text-xs text-red-400 flex items-center gap-1">
                <Trash2 size={12} /> Apagar
              </button>
            </>
          )}
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
