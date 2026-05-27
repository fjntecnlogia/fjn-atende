"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Sparkles, Zap, Bot } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  company_name: z.string().min(2, "Informe o nome da empresa").max(120),
  slug: z.string()
    .min(3, "Mínimo 3 caracteres")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
  owner_name: z.string().min(2, "Informe seu nome").max(120),
  owner_email: z.string().email("E-mail inválido"),
  owner_password: z.string().min(8, "Mínimo 8 caracteres"),
  owner_phone: z.string().optional(),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar os Termos e a Política de Privacidade" }),
  }),
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const companyName = watch("company_name") ?? "";

  // Sugere slug a partir do nome
  function suggestedSlug(): string {
    return companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      // Remove accept_terms do payload — só validação no frontend
      const { accept_terms, ...payload } = data;
      const r = await api.post("/auth/signup", payload);
      setSession(r.data.token, r.data.user, r.data.tenant);
      toast.success("Conta criada! Bem-vindo ao FJN Atende 🎉", { duration: 5000 });
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy2 flex">
      {/* Lado esquerdo — Pitch */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none"
             style={{
               background:
                 "radial-gradient(circle at 20% 30%, rgba(255,186,0,0.15), transparent 60%)," +
                 "radial-gradient(circle at 70% 80%, rgba(15,26,82,0.6), transparent 50%)",
             }}/>
        <div className="relative">
          <div className="font-display font-extrabold tracking-tight text-3xl">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </div>
          <p className="text-sm text-gray2 mt-1">Por FJN Tecnologia</p>
        </div>

        <div className="relative space-y-6 my-12">
          <h1 className="font-display text-5xl font-extrabold text-light leading-tight">
            Seu atendimento WhatsApp<br/>
            com <span className="text-orange">inteligência artificial</span>
          </h1>
          <p className="text-lg text-gray2">
            A IA atende seus clientes 24/7 com o tom da sua marca,
            qualifica leads e transfere pra você quando importa.
          </p>

          <div className="space-y-4 mt-8">
            <Feature icon={<Bot className="text-orange" />} text="IA Claude treinada com os seus produtos e serviços" />
            <Feature icon={<Zap className="text-orange" />} text="Resposta em segundos, com tom humanizado" />
            <Feature icon={<Sparkles className="text-orange" />} text="Painel com conversas em tempo real, leads e métricas" />
          </div>
        </div>

        <p className="text-xs text-gray2 relative">
          Teste grátis 14 dias · Sem cartão de crédito · Cancela quando quiser
        </p>
      </div>

      {/* Lado direito — Formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="card p-8 w-full max-w-md">
          <div className="text-center mb-6 lg:hidden">
            <div className="font-display font-extrabold tracking-tight text-2xl">
              <span className="text-orange">FJN</span>
              <span className="text-light"> Atende</span>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-light mb-1">Criar conta grátis</h2>
          <p className="text-sm text-gray2 mb-6">14 dias de teste, sem cartão</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="label block mb-1">Nome da empresa</label>
              <input className="input w-full" placeholder="Ex: Barbearia do João"
                     {...register("company_name")} />
              {errors.company_name && <p className="text-orange text-xs mt-1">{errors.company_name.message}</p>}
            </div>

            <div>
              <label className="label block mb-1">URL única (slug)</label>
              <div className="flex items-center bg-navy2 border border-border rounded-lg overflow-hidden">
                <span className="text-xs text-gray2 px-3">atende.fjn.com/</span>
                <input className="flex-1 bg-transparent py-2 pr-3 text-light text-sm focus:outline-none"
                       placeholder={suggestedSlug() || "minhaempresa"}
                       {...register("slug")} />
              </div>
              {errors.slug && <p className="text-orange text-xs mt-1">{errors.slug.message}</p>}
            </div>

            <hr className="border-border my-4" />

            <div>
              <label className="label block mb-1">Seu nome</label>
              <input className="input w-full" placeholder="João da Silva"
                     {...register("owner_name")} />
              {errors.owner_name && <p className="text-orange text-xs mt-1">{errors.owner_name.message}</p>}
            </div>

            <div>
              <label className="label block mb-1">E-mail</label>
              <input className="input w-full" type="email" placeholder="voce@empresa.com"
                     {...register("owner_email")} />
              {errors.owner_email && <p className="text-orange text-xs mt-1">{errors.owner_email.message}</p>}
            </div>

            <div>
              <label className="label block mb-1">Senha (mín. 8 caracteres)</label>
              <input className="input w-full" type="password" placeholder="••••••••"
                     {...register("owner_password")} />
              {errors.owner_password && <p className="text-orange text-xs mt-1">{errors.owner_password.message}</p>}
            </div>

            <div>
              <label className="label block mb-1">WhatsApp (opcional)</label>
              <input className="input w-full" placeholder="(11) 99999-8888"
                     {...register("owner_phone")} />
            </div>

            <label className="flex items-start gap-2 mt-2 text-xs text-light/80 cursor-pointer">
              <input type="checkbox" {...register("accept_terms")} className="mt-0.5 accent-orange shrink-0" />
              <span>
                Eu li e aceito os{" "}
                <Link href="/termos" target="_blank" className="text-orange hover:underline">Termos de Uso</Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="text-orange hover:underline">Política de Privacidade</Link>.
                Concordo com o tratamento de dados conforme LGPD.
              </span>
            </label>
            {errors.accept_terms && (
              <p className="text-orange text-xs">{errors.accept_terms.message}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
              {loading ? "Criando conta..." : "Criar conta grátis"}
            </button>

            <p className="text-center text-xs text-gray2 mt-4">
              Já tem conta? <Link href="/login" className="text-orange hover:underline">Entrar</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-orange/10 p-2 rounded-lg">{icon}</div>
      <p className="text-light pt-1">{text}</p>
    </div>
  );
}
