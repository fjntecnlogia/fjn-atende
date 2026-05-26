"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const r = await api.post("/auth/login", data);
      setSession(r.data.token, r.data.user, r.data.tenant);
      toast.success(`Bem-vindo, ${r.data.user.name.split(" ")[0]}!`);
      // Super-admin vai pra área de admin; outros pro dashboard normal
      if (r.data.user.role === "super_admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy2">
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,186,0,0.08), transparent 60%)," +
            "radial-gradient(circle at 80% 70%, rgba(15,26,82,0.6), transparent 50%)",
        }}
      />
      <div className="card p-8 w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="font-display font-extrabold tracking-tight text-3xl">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </div>
          <p className="text-sm text-gray2 mt-2">Atendimento WhatsApp com IA</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label block mb-1.5">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              className="input w-full"
              placeholder="seu@email.com"
              {...register("email")}
            />
            {errors.email && <p className="text-orange text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label block mb-1.5">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input w-full"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && <p className="text-orange text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray2 mt-6">
          Novo por aqui?{" "}
          <Link href="/signup" className="text-orange hover:underline font-semibold">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
