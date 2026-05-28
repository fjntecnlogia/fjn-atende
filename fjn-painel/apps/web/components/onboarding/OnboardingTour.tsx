"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Smartphone, Bot, Kanban, HelpCircle,
  ArrowRight, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Step {
  icon: any;
  iconColor: string;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    iconColor: "text-orange",
    title: "Bem-vindo ao FJN Atende! 🎉",
    body: (
      <>
        <p>Vamos te dar um tour rápido (3 minutos) pra você começar a usar.</p>
        <p className="mt-3 text-sm text-gray2">
          Você pode pular agora e voltar depois em <strong className="text-orange">Ajuda</strong> no menu lateral.
        </p>
      </>
    ),
  },
  {
    icon: Smartphone,
    iconColor: "text-green-400",
    title: "1️⃣ Conecte o WhatsApp",
    body: (
      <>
        <p>Primeiro passo: conectar seu <strong>WhatsApp Business</strong> com o sistema.</p>
        <p className="mt-3 text-sm text-light/80">
          ✅ Você precisa de <strong>chip dedicado</strong> + WhatsApp Business instalado
        </p>
        <p className="mt-1 text-sm text-light/80">
          ⚠️ <strong>NÃO</strong> use seu número pessoal
        </p>
        <p className="mt-1 text-sm text-light/80">
          📱 Você vai escanear um QR code (Menu → Dispositivos conectados → Conectar)
        </p>
      </>
    ),
    cta: { label: "Ir pra WhatsApp →", href: "/whatsapp" },
  },
  {
    icon: Bot,
    iconColor: "text-blue-400",
    title: "2️⃣ Personalize a IA",
    body: (
      <>
        <p>Configure como a IA atende seus clientes:</p>
        <ul className="mt-3 text-sm space-y-2 text-light/80 list-disc list-inside">
          <li><strong>Nome</strong> da assistente (ex: Joana)</li>
          <li><strong>Tom de voz</strong> (formal? caloroso? direto?)</li>
          <li><strong>Produtos</strong> que você vende</li>
          <li><strong>Regras</strong> específicas do seu negócio</li>
        </ul>
        <p className="mt-3 text-xs text-gray2">
          💡 Quanto mais detalhado, melhor a resposta da IA.
        </p>
      </>
    ),
    cta: { label: "Ir pra Config IA →", href: "/config" },
  },
  {
    icon: Kanban,
    iconColor: "text-orange",
    title: "3️⃣ Acompanhe no Funil",
    body: (
      <>
        <p>Toda conversa que chegar vira automaticamente um <strong>card no Kanban</strong>.</p>
        <p className="mt-3 text-sm text-light/80">
          Etapas padrão: Novo → Qualificando → Proposta → Negociação → Ganho/Perdido
        </p>
        <p className="mt-3 text-sm text-light/80">
          🎯 Arraste cards entre etapas, atribua atendentes, registre valor e notas.
        </p>
      </>
    ),
    cta: { label: "Ver Funil →", href: "/funis" },
  },
  {
    icon: HelpCircle,
    iconColor: "text-orange",
    title: "🚀 Pronto pra começar!",
    body: (
      <>
        <p>Resumo do que vimos:</p>
        <ul className="mt-3 text-sm space-y-2 text-light/80">
          <li>📱 Conecta WhatsApp em <strong>/whatsapp</strong></li>
          <li>🤖 Configura IA em <strong>/config</strong></li>
          <li>📊 Acompanha funil em <strong>/funis</strong></li>
          <li>📣 Faz campanhas em <strong>/campanhas</strong></li>
          <li>💳 Gerencia plano em <strong>/configuracoes/plano</strong></li>
        </ul>
        <p className="mt-4 text-sm text-orange">
          📚 Tutoriais completos em <strong>/ajuda</strong>
        </p>
        <p className="mt-3 text-sm text-gray2">
          Travou? <a href="https://wa.me/5565980900089" target="_blank" rel="noreferrer"
                     className="text-orange font-bold hover:underline">WhatsApp (65) 98090-0089</a>
        </p>
      </>
    ),
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Mostra tour se user logado e ainda não completou onboarding
    if (user && !(user as any).onboarding_completed_at) {
      // Atraso pequeno pra não pegar primeiro render
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const doneMut = useMutation({
    mutationFn: async () => (await api.post("/auth/onboarding-done")).data,
  });

  function close() {
    setOpen(false);
    doneMut.mutate();
  }

  function next() {
    if (step >= STEPS.length - 1) {
      close();
    } else {
      setStep(step + 1);
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/90 p-4 animate-in fade-in">
      <div className="card p-6 max-w-lg w-full relative">
        {/* Botão pular */}
        <button onClick={close}
                className="absolute top-3 right-3 text-gray2 hover:text-light p-1">
          <X size={18} />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "bg-orange w-8" :
                i < step  ? "bg-orange/40 w-3" :
                "bg-gray2/30 w-3"
              }`}
            />
          ))}
        </div>

        {/* Ícone gigante */}
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-full bg-navy3 ${current.iconColor}`}>
            <Icon size={36} />
          </div>
        </div>

        {/* Título */}
        <h2 className="font-display text-2xl font-extrabold text-light text-center mb-3">
          {current.title}
        </h2>

        {/* Body */}
        <div className="text-light/90 text-center min-h-[140px]">
          {current.body}
        </div>

        {/* CTA secundária */}
        {current.cta && (
          <div className="text-center mt-4">
            <Link href={current.cta.href} onClick={close}
                  className="text-sm text-orange hover:underline">
              {current.cta.label}
            </Link>
          </div>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button onClick={prev} disabled={step === 0}
                  className="text-sm text-gray2 hover:text-light flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={14} /> Voltar
          </button>

          <button onClick={close} className="text-xs text-gray2 hover:text-light">
            Pular tour
          </button>

          <button onClick={next}
                  className="btn-primary text-sm flex items-center gap-1">
            {isLast ? "Começar!" : "Próximo"}
            {!isLast && <ChevronRight size={14} />}
            {isLast && <ArrowRight size={14} />}
          </button>
        </div>

        {/* Contador */}
        <p className="text-center text-[10px] text-gray2 mt-3">
          {step + 1} de {STEPS.length}
        </p>
      </div>
    </div>
  );
}
