"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, X, Plus, Trash2, Send, Download, CheckCircle2, XCircle,
  RefreshCw, ArrowRight, MessageSquare, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface DocumentItem {
  id?: number;
  position: number;
  code?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price_cents: number;
  discount_cents: number;
  subtotal_cents?: number;
}

interface DocumentModalProps {
  cardId: number;
  cardConversationId: number;
  cardContactName: string | null;
  cardContactPhone: string | null;
  onClose: () => void;
}

function money(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function parseMoney(str: string): number {
  const clean = str.replace(/[^\d,]/g, "").replace(",", ".");
  return Math.round(parseFloat(clean || "0") * 100);
}

export function DocumentModal({
  cardId, cardConversationId, cardContactName, cardContactPhone, onClose,
}: DocumentModalProps) {
  const qc = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [tab, setTab] = useState<"list" | "editor">("list");

  // Lista documentos do card
  const { data: docsData, refetch: refetchDocs } = useQuery<any>({
    queryKey: ["docs-by-card", cardId],
    queryFn: async () =>
      (await api.get(`/documents?card_id=${cardId}`)).data,
  });
  const docs = docsData?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (type: "quote" | "contract") => {
      const r = await api.post("/documents", {
        card_id: cardId,
        conversation_id: cardConversationId,
        type,
        client_name: cardContactName || "Cliente",
        client_phone: cardContactPhone,
      });
      return r.data;
    },
    onSuccess: (doc) => {
      refetchDocs();
      setSelectedDocId(doc.id);
      setTab("editor");
      toast.success(`${doc.type === "quote" ? "Orçamento" : "Contrato"} #${String(doc.number).padStart(4, "0")} criado`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4" onClick={onClose}>
      <div className="card p-0 max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold flex items-center gap-2">
            <FileText className="text-orange" size={20} />
            Orçamentos & Contratos
            <span className="text-xs text-gray2 font-normal">
              — {cardContactName ?? cardContactPhone ?? "Cliente"}
            </span>
          </h2>
          <button onClick={onClose} className="text-gray2 hover:text-light">
            <X size={20} />
          </button>
        </div>

        {tab === "list" ? (
          <>
            {/* Botões criar */}
            <div className="p-4 border-b border-border flex gap-2">
              <button onClick={() => createMut.mutate("quote")}
                      disabled={createMut.isPending}
                      className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={14} /> Novo orçamento
              </button>
              <button onClick={() => createMut.mutate("contract")}
                      disabled={createMut.isPending}
                      className="btn-ghost flex items-center gap-2 text-sm">
                <Plus size={14} /> Novo contrato
              </button>
            </div>

            {/* Lista de docs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {docs.length === 0 ? (
                <div className="text-center py-12 text-gray2">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum documento criado ainda</p>
                  <p className="text-xs mt-1">Clica em "Novo orçamento" pra começar</p>
                </div>
              ) : (
                docs.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDocId(d.id); setTab("editor"); }}
                    className="w-full card p-3 hover:border-orange/40 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            d.type === "contract"
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              : "bg-orange/15 text-orange border-orange/30"
                          }`}>
                            {d.type === "contract" ? "Contrato" : "Orçamento"}
                          </span>
                          <span className="text-sm font-mono text-light font-bold">
                            #{String(d.number).padStart(4, "0")}
                          </span>
                          {d.revision > 1 && (
                            <span className="text-[10px] text-gray2">rev {d.revision}</span>
                          )}
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="text-xs text-gray2">
                          {d.items_count} itens · Total <strong className="text-orange">{money(Number(d.total_cents))}</strong>
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-gray2" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <DocumentEditor
            documentId={selectedDocId!}
            onBack={() => { setTab("list"); refetchDocs(); }}
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: "Rascunho",  cls: "bg-gray2/15 text-gray2 border-gray2/30" },
    sent:      { label: "Enviado",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    viewed:    { label: "Visto",     cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    approved:  { label: "Aprovado",  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    rejected:  { label: "Rejeitado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    expired:   { label: "Expirado",  cls: "bg-orange/15 text-orange border-orange/30" },
    canceled:  { label: "Cancelado", cls: "bg-gray2/15 text-gray2 border-gray2/30" },
    converted: { label: "Convertido",cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    signed:    { label: "Assinado",  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// =====================================================================
// Editor do documento
// =====================================================================
function DocumentEditor({ documentId, onBack }: { documentId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [newItem, setNewItem] = useState<Partial<DocumentItem>>({
    description: "", quantity: 1, unit_price_cents: 0, discount_cents: 0,
  });

  const { data: doc, refetch } = useQuery<any>({
    queryKey: ["document", documentId],
    queryFn: async () => (await api.get(`/documents/${documentId}`)).data,
  });

  useEffect(() => {
    if (doc?.items) setItems(doc.items);
  }, [doc?.items]);

  const [clientForm, setClientForm] = useState<any>({});
  useEffect(() => {
    if (doc) {
      setClientForm({
        client_name: doc.client_name ?? "",
        client_document: doc.client_document ?? "",
        client_email: doc.client_email ?? "",
        client_phone: doc.client_phone ?? "",
        client_address: doc.client_address ?? "",
        payment_terms: doc.payment_terms ?? "",
        terms: doc.terms ?? "",
      });
    }
  }, [doc?.id]);

  const updateDocMut = useMutation({
    mutationFn: async (patch: any) =>
      (await api.put(`/documents/${documentId}`, patch)).data,
    onSuccess: () => { refetch(); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const addItemMut = useMutation({
    mutationFn: async (item: Partial<DocumentItem>) =>
      (await api.post(`/documents/${documentId}/items`, item)).data,
    onSuccess: () => {
      refetch();
      setNewItem({ description: "", quantity: 1, unit_price_cents: 0, discount_cents: 0 });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro ao adicionar"),
  });

  const removeItemMut = useMutation({
    mutationFn: async (itemId: number) =>
      api.delete(`/documents/${documentId}/items/${itemId}`),
    onSuccess: () => refetch(),
  });

  const sendMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/documents/${documentId}/send-whatsapp`, {})).data,
    onSuccess: () => { refetch(); toast.success("Enviado por WhatsApp!"); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro no envio"),
  });

  const approveMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/documents/${documentId}/approve`)).data,
    onSuccess: () => { refetch(); toast.success("Aprovado!"); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      const reason = prompt("Motivo da rejeição (opcional):");
      return (await api.post(`/documents/${documentId}/reject`, { reason: reason ?? undefined })).data;
    },
    onSuccess: () => { refetch(); toast("Rejeitado", { icon: "❌" }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const revisionMut = useMutation({
    mutationFn: async () => (await api.post(`/documents/${documentId}/revision`)).data,
    onSuccess: (newDoc) => {
      toast.success(`Nova revisão criada (v${newDoc.revision})`);
      onBack();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  const convertMut = useMutation({
    mutationFn: async () => (await api.post(`/documents/${documentId}/convert`)).data,
    onSuccess: () => {
      toast.success("Convertido em contrato!");
      onBack();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  if (!doc) return <div className="flex-1 p-8 flex items-center justify-center"><Loader2 className="animate-spin text-orange" /></div>;

  const isEditable = ["draft", "sent", "viewed", "rejected"].includes(doc.status);
  const isQuote = doc.type === "quote";
  const isApproved = doc.status === "approved";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header do editor */}
      <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-navy2 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray2 hover:text-light text-sm">← Voltar</button>
          <span className="text-sm font-mono text-light font-bold">
            {doc.type === "contract" ? "CONTRATO" : "ORÇAMENTO"} #{String(doc.number).padStart(4, "0")}
            {doc.revision > 1 && ` · rev ${doc.revision}`}
          </span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="text-orange font-display font-extrabold text-lg">
          {money(Number(doc.total_cents))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Cliente */}
        <div>
          <h3 className="text-xs uppercase font-bold text-gray2 mb-2">Dados do cliente</h3>
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Nome/Empresa"
                   value={clientForm.client_name} disabled={!isEditable}
                   onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })} />
            <input className="input text-sm" placeholder="CPF/CNPJ"
                   value={clientForm.client_document} disabled={!isEditable}
                   onChange={(e) => setClientForm({ ...clientForm, client_document: e.target.value })} />
            <input className="input text-sm" placeholder="E-mail" type="email"
                   value={clientForm.client_email} disabled={!isEditable}
                   onChange={(e) => setClientForm({ ...clientForm, client_email: e.target.value })} />
            <input className="input text-sm" placeholder="Telefone"
                   value={clientForm.client_phone} disabled={!isEditable}
                   onChange={(e) => setClientForm({ ...clientForm, client_phone: e.target.value })} />
            <textarea className="input text-sm col-span-2" rows={1} placeholder="Endereço"
                      value={clientForm.client_address} disabled={!isEditable}
                      onChange={(e) => setClientForm({ ...clientForm, client_address: e.target.value })} />
          </div>
          {isEditable && (
            <button onClick={() => updateDocMut.mutate(clientForm)}
                    className="btn-ghost text-xs mt-2">Salvar dados do cliente</button>
          )}
        </div>

        {/* Itens */}
        <div>
          <h3 className="text-xs uppercase font-bold text-gray2 mb-2">Itens</h3>
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy3 text-[10px] uppercase text-gray2 font-bold text-left">
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 w-16">Qtd</th>
                  <th className="p-2 w-24">Unit.</th>
                  <th className="p-2 w-24">Subtotal</th>
                  {isEditable && <th className="p-2 w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-gray2 italic text-xs">Nenhum item — adicione abaixo</td></tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={item.id ?? i} className="border-t border-border/50">
                      <td className="p-2 text-gray2 font-mono text-xs">{i + 1}</td>
                      <td className="p-2 text-light">{item.description}</td>
                      <td className="p-2 text-gray2 text-xs">{Number(item.quantity).toLocaleString("pt-BR")} {item.unit}</td>
                      <td className="p-2 text-light/80 text-xs">{money(Number(item.unit_price_cents))}</td>
                      <td className="p-2 text-orange font-bold">{money(Number(item.subtotal_cents ?? 0))}</td>
                      {isEditable && (
                        <td className="p-2">
                          <button onClick={() => item.id && removeItemMut.mutate(item.id)}
                                  className="text-gray2 hover:text-red-400">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isEditable && (
            <div className="grid grid-cols-[1fr,80px,120px,120px,auto] gap-2 mt-2">
              <input className="input text-sm" placeholder="Descrição do item"
                     value={newItem.description}
                     onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
              <input className="input text-sm" placeholder="Qtd" type="number" step="0.01"
                     value={newItem.quantity ?? 1}
                     onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
              <input className="input text-sm" placeholder="Valor unit."
                     onChange={(e) => setNewItem({ ...newItem, unit_price_cents: parseMoney(e.target.value) })} />
              <input className="input text-sm" placeholder="Desconto"
                     onChange={(e) => setNewItem({ ...newItem, discount_cents: parseMoney(e.target.value) })} />
              <button onClick={() => {
                if (!newItem.description) return toast.error("Descrição obrigatória");
                addItemMut.mutate(newItem);
              }} className="btn-primary text-sm px-3">
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Totais */}
          <div className="mt-3 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-gray2">
                <span>Subtotal:</span>
                <span>{money(Number(doc.subtotal_cents))}</span>
              </div>
              {Number(doc.discount_cents) > 0 && (
                <div className="flex justify-between text-gray2">
                  <span>Desconto:</span>
                  <span>- {money(Number(doc.discount_cents))}</span>
                </div>
              )}
              <div className="flex justify-between text-orange font-display font-extrabold text-lg pt-1 border-t border-border">
                <span>TOTAL:</span>
                <span>{money(Number(doc.total_cents))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Termos */}
        <div>
          <h3 className="text-xs uppercase font-bold text-gray2 mb-2">Condições</h3>
          <textarea className="input w-full text-sm mb-2" rows={2} placeholder="Condições de pagamento"
                    value={clientForm.payment_terms ?? ""} disabled={!isEditable}
                    onChange={(e) => setClientForm({ ...clientForm, payment_terms: e.target.value })} />
          <textarea className="input w-full text-sm" rows={2} placeholder="Termos gerais"
                    value={clientForm.terms ?? ""} disabled={!isEditable}
                    onChange={(e) => setClientForm({ ...clientForm, terms: e.target.value })} />
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/pdf`}
             target="_blank" rel="noreferrer"
             className="btn-ghost text-sm flex items-center gap-2">
            <Download size={14} /> Baixar PDF
          </a>
          {(doc.status === "draft" || doc.status === "sent" || doc.status === "rejected") && (
            <button onClick={() => sendMut.mutate()}
                    disabled={sendMut.isPending}
                    className="btn-primary text-sm flex items-center gap-2">
              {sendMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
              Enviar por WhatsApp
            </button>
          )}
          {(doc.status === "sent" || doc.status === "viewed" || doc.status === "rejected") && isQuote && (
            <>
              <button onClick={() => approveMut.mutate()}
                      className="text-sm py-2 px-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 flex items-center gap-2">
                <CheckCircle2 size={14} /> Marcar aprovado
              </button>
              <button onClick={() => rejectMut.mutate()}
                      className="text-sm py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-2">
                <XCircle size={14} /> Rejeitar
              </button>
            </>
          )}
          {isEditable && (
            <button onClick={() => revisionMut.mutate()} className="btn-ghost text-sm flex items-center gap-2">
              <RefreshCw size={14} /> Nova revisão
            </button>
          )}
          {isApproved && isQuote && (
            <button onClick={() => convertMut.mutate()}
                    className="btn-primary text-sm flex items-center gap-2 ml-auto">
              Converter em contrato <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Eventos */}
        {doc.events?.length > 0 && (
          <div>
            <h3 className="text-xs uppercase font-bold text-gray2 mb-2">Histórico</h3>
            <ul className="space-y-1 text-xs">
              {doc.events.slice(0, 10).map((e: any) => (
                <li key={e.id} className="text-light/80">
                  <span className="text-gray2">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                  {" · "}
                  <strong className="text-orange">{e.event_type}</strong>
                  {e.actor_name && <span className="text-gray2"> por {e.actor_name}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
