"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Upload, Globe, Mail, Phone, EyeOff, Image as ImageIcon, Crown, Lock, Save } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { PageIntro } from "@/components/layout/PageIntro";

interface Branding {
  name: string;
  slug: string;
  branding: {
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    company_name_override?: string;
  };
  hide_fjn_branding: boolean;
  support_email: string | null;
  support_phone: string | null;
  subdomain: string | null;
}

export default function BrandingPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: async () => (await api.get("/branding")).data,
  });

  const { data: sub } = useQuery<any>({
    queryKey: ["subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data,
    retry: false,
  });

  // Feature gating: requer custom_branding ou white_label
  const canUseBranding =
    sub?.features?.custom_branding ||
    sub?.features?.white_label ||
    !sub?.has_subscription; // permite preview se ainda não assinou

  const canUseWhiteLabel = sub?.features?.white_label;

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (branding) {
      setForm({
        logo_url: branding.branding?.logo_url ?? "",
        primary_color: branding.branding?.primary_color ?? "#0B1340",
        accent_color: branding.branding?.accent_color ?? "#FFBA00",
        company_name_override: branding.branding?.company_name_override ?? "",
        subdomain: branding.subdomain ?? "",
        hide_fjn_branding: branding.hide_fjn_branding ?? false,
        support_email: branding.support_email ?? "",
        support_phone: branding.support_phone ?? "",
      });
    }
  }, [branding]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        company_name_override: form.company_name_override || null,
        support_email: form.support_email || null,
        support_phone: form.support_phone || null,
      };
      if (canUseWhiteLabel) {
        payload.subdomain = form.subdomain || null;
        payload.hide_fjn_branding = form.hide_fjn_branding;
      }
      return (await api.put("/branding", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding atualizado!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Erro"),
  });

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
      toast.error("Logo maior que 100KB. Comprime a imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await api.post("/branding/upload-logo", { data_url: dataUrl });
        qc.invalidateQueries({ queryKey: ["branding"] });
        toast.success("Logo enviada!");
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? "Erro ao enviar logo");
      }
    };
    reader.readAsDataURL(file);
  }

  if (isLoading) return <div className="p-8 text-gray2">Carregando...</div>;
  if (!branding) return <div className="p-8 text-gray2">Sem dados</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Palette className="text-orange" />
          Branding
        </h1>
        <p className="text-sm text-gray2 mt-1">
          Personalize logo, cores e contato exibidos no painel
        </p>
      </div>

      <PageIntro
        storageKey="branding-intro"
        title="Personalize sua marca no painel"
        description="Substitui logo e cores padrão do FJN Atende pelas suas. Ideal pra impressionar clientes e reforçar sua identidade visual."
        steps={[
          "Faz upload do logo (PNG/SVG até 100KB) ou cola URL externa",
          "Escolhe cores primária (fundo) e destaque (botões, links)",
          "Preview aparece no topo em tempo real",
          "Pro+ ganha subdomain próprio (ex: minhaempresa.atende.fjntecnologia.com.br)",
        ]}
        helpArticle={{ slug: "personalizar-marca", label: "Guia de white-label" }}
      />

      {!canUseBranding && (
        <div className="card p-4 bg-orange/10 border-orange/40">
          <p className="text-sm text-light/90 flex items-center gap-2">
            <Lock size={16} className="text-orange" />
            <span>Branding personalizado é disponível no plano <strong className="text-orange">Pro+</strong>.{" "}
              <a href="/planos" className="underline">Fazer upgrade →</a>
            </span>
          </p>
        </div>
      )}

      {/* Preview ao vivo */}
      <div className="card p-6"
           style={{
             backgroundColor: form.primary_color || "#0B1340",
             borderColor: form.accent_color || "#FFBA00",
           }}>
        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold mb-3">
          Pré-visualização
        </p>
        <div className="flex items-center gap-3">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-lg flex items-center justify-center"
                 style={{ backgroundColor: form.accent_color + "30" }}>
              <ImageIcon size={20} style={{ color: form.accent_color }} />
            </div>
          )}
          <div>
            <p className="font-display font-extrabold text-2xl text-white">
              {form.company_name_override || branding.name}
            </p>
            {!form.hide_fjn_branding && (
              <p className="text-[10px] text-white/40">Powered by FJN Atende</p>
            )}
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <ImageIcon size={18} className="text-orange" />
          Logo
        </h2>
        <p className="text-xs text-gray2 mb-3">
          Recomendado: PNG/SVG horizontal, fundo transparente, máximo 100KB.
        </p>

        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()}
                  disabled={!canUseBranding}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Upload size={14} /> Enviar arquivo
          </button>
          <input ref={fileInputRef} type="file"
                 accept="image/png,image/jpeg,image/svg+xml,image/webp"
                 onChange={handleFileSelected}
                 className="hidden" />
          <span className="text-xs text-gray2">ou cola URL externa:</span>
        </div>
        <input
          className="input w-full mt-3"
          placeholder="https://meusite.com/logo.png"
          value={form.logo_url ?? ""}
          disabled={!canUseBranding}
          onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
        />
      </div>

      {/* Cores */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Palette size={18} className="text-orange" />
          Cores
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorInput
            label="Primária (fundo)"
            value={form.primary_color}
            disabled={!canUseBranding}
            onChange={(v: string) => setForm({ ...form, primary_color: v })}
            hint="Cor de fundo dos painéis"
          />
          <ColorInput
            label="Destaque (acento)"
            value={form.accent_color}
            disabled={!canUseBranding}
            onChange={(v: string) => setForm({ ...form, accent_color: v })}
            hint="Cor de botões, links e destaques"
          />
        </div>
      </div>

      {/* Nome */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-3">Nome de exibição (opcional)</h2>
        <p className="text-xs text-gray2 mb-3">
          Se preenchido, substitui o nome da empresa no painel.
        </p>
        <input
          className="input w-full"
          placeholder={branding.name}
          value={form.company_name_override ?? ""}
          disabled={!canUseBranding}
          onChange={(e) => setForm({ ...form, company_name_override: e.target.value })}
        />
      </div>

      {/* Contato */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-4">Contato de suporte (aparece no rodapé dos e-mails)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label flex items-center gap-1 mb-1"><Mail size={12} /> E-mail</label>
            <input className="input w-full" placeholder="suporte@empresa.com"
                   value={form.support_email ?? ""}
                   disabled={!canUseBranding}
                   onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
          </div>
          <div>
            <label className="label flex items-center gap-1 mb-1"><Phone size={12} /> WhatsApp</label>
            <input className="input w-full" placeholder="(11) 99999-8888"
                   value={form.support_phone ?? ""}
                   disabled={!canUseBranding}
                   onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
          </div>
        </div>
      </div>

      {/* White-label (Enterprise) */}
      <div className={`card p-6 ${canUseWhiteLabel ? "" : "opacity-60"}`}>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Crown size={18} className="text-orange" />
          White-label completo
          {!canUseWhiteLabel && (
            <span className="ml-2 text-[10px] bg-orange/15 text-orange px-2 py-0.5 rounded-full font-bold uppercase">
              Enterprise
            </span>
          )}
        </h2>
        <p className="text-xs text-gray2 mb-4">
          Subdomain personalizado e remoção total da marca FJN.
        </p>

        <div>
          <label className="label flex items-center gap-1 mb-1">
            <Globe size={12} /> Subdomain personalizado
          </label>
          <div className="flex items-center bg-navy2 border border-border rounded-lg overflow-hidden">
            <input className="flex-1 bg-transparent px-3 py-2 text-light text-sm focus:outline-none disabled:cursor-not-allowed"
                   placeholder="minhaempresa"
                   value={form.subdomain ?? ""}
                   disabled={!canUseWhiteLabel}
                   onChange={(e) => setForm({ ...form, subdomain: e.target.value.toLowerCase() })} />
            <span className="text-xs text-gray2 px-3">.atende.fjntecnologia.com.br</span>
          </div>
          <p className="text-[10px] text-gray2 mt-1">
            Depois de configurar, aponte um CNAME do seu domínio (ex: atende.empresa.com)
            pra <code className="text-orange">cname.vercel-dns.com</code>.
          </p>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input type="checkbox"
                 checked={form.hide_fjn_branding}
                 disabled={!canUseWhiteLabel}
                 onChange={(e) => setForm({ ...form, hide_fjn_branding: e.target.checked })}
                 className="accent-orange" />
          <span className="flex items-center gap-2 text-sm text-light">
            <EyeOff size={14} className="text-orange" />
            Esconder marca FJN dos e-mails e do painel
          </span>
        </label>
      </div>

      {/* Salvar */}
      <div className="flex justify-end gap-2">
        <button onClick={() => saveMut.mutate()}
                disabled={!canUseBranding || saveMut.isPending}
                className="btn-primary flex items-center gap-2">
          <Save size={14} />
          {saveMut.isPending ? "Salvando..." : "Salvar branding"}
        </button>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange, disabled, hint }: any) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} disabled={disabled}
               onChange={(e) => onChange(e.target.value)}
               className="h-10 w-14 rounded cursor-pointer bg-transparent border border-border disabled:cursor-not-allowed" />
        <input type="text" value={value} disabled={disabled}
               onChange={(e) => onChange(e.target.value)}
               className="input flex-1 font-mono text-sm uppercase" />
      </div>
      {hint && <p className="text-[10px] text-gray2 mt-1">{hint}</p>}
    </div>
  );
}
