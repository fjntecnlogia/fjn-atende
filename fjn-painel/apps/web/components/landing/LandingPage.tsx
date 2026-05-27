"use client";

import Link from "next/link";
import {
  MessageSquare, Bot, Megaphone, Shield, Zap, TrendingUp,
  ArrowRight, Check, Star, Clock, Users, BarChart3, Settings,
  Phone, Sparkles, ShieldCheck, Headphones, Award, ChevronDown,
} from "lucide-react";
import { useState } from "react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-navy2 text-light">
      <Header />
      <Hero />
      <SocialProof />
      <Pain />
      <Features />
      <HowItWorks />
      <Pricing />
      <UseCases />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// =====================================================================
// HEADER
// =====================================================================
function Header() {
  return (
    <header className="sticky top-0 z-50 bg-navy2/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-extrabold tracking-tight text-lg">
          <span className="text-orange">FJN</span>
          <span className="text-light"> Atende</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#features" className="text-light/70 hover:text-light">Recursos</a>
          <a href="#pricing" className="text-light/70 hover:text-light">Planos</a>
          <a href="#faq" className="text-light/70 hover:text-light">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-light/70 hover:text-light">Entrar</Link>
          <Link href="/signup" className="btn-primary text-sm">Criar conta grátis</Link>
        </div>
      </div>
    </header>
  );
}

// =====================================================================
// HERO
// =====================================================================
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,186,0,0.12), transparent 60%)," +
            "radial-gradient(circle at 80% 70%, rgba(15,26,82,0.6), transparent 50%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28 text-center">
        <div className="inline-flex items-center gap-2 bg-orange/10 border border-orange/30 rounded-full px-4 py-1.5 mb-6">
          <Sparkles size={14} className="text-orange" />
          <span className="text-xs font-bold uppercase tracking-widest text-orange">
            IA + Disparo no WhatsApp
          </span>
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-7xl leading-tight max-w-5xl mx-auto">
          Atendimento de WhatsApp{" "}
          <span className="text-orange">automatizado por IA</span>{" "}
          que <span className="text-orange">vende por você</span>
        </h1>
        <p className="text-light/70 text-lg md:text-xl mt-6 max-w-3xl mx-auto">
          A FJN Atende responde seus clientes 24/7 com tom humano, qualifica leads,
          agenda atendimentos e dispara campanhas em massa. Tudo no seu próprio número
          de WhatsApp.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <Link href="/signup" className="btn-primary text-base px-8 py-3 inline-flex items-center justify-center gap-2">
            Testar grátis por 14 dias
            <ArrowRight size={16} />
          </Link>
          <a href="#features" className="btn-ghost text-base px-8 py-3 border border-border inline-flex items-center justify-center gap-2">
            Ver como funciona
          </a>
        </div>
        <p className="text-xs text-gray2 mt-4">
          Sem cartão de crédito • Setup em 5 minutos • Suporte humano
        </p>

        {/* Mockup ilustrativo */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="card p-2 shadow-glow">
            <div className="bg-navy3/80 rounded-xl p-6 md:p-10">
              <div className="grid md:grid-cols-2 gap-6 text-left">
                <ChatMockup />
                <div className="space-y-3">
                  <div className="bg-navy2/60 border border-border rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-orange/80">Conversa #42</p>
                    <p className="font-semibold text-sm mt-1">Carlos Silva (qualificado)</p>
                    <p className="text-xs text-gray2 mt-1">Interesse: Plano Pro</p>
                  </div>
                  <div className="bg-orange/10 border border-orange/30 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-orange">Lead capturado</p>
                    <p className="font-semibold text-sm mt-1">+12 leads hoje</p>
                    <p className="text-xs text-light/70 mt-1">Conversão IA: 73%</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-green-400">Campanha ativa</p>
                    <p className="font-semibold text-sm mt-1">Black Friday — 1.247/2.000</p>
                    <div className="h-1.5 bg-navy4 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: "62%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatMockup() {
  return (
    <div className="space-y-2">
      <ChatBubble side="left" name="Cliente">Oi, queria saber sobre o plano Pro</ChatBubble>
      <ChatBubble side="right" name="Ana (FJN)">
        Oi! Tudo bem? 🚀<br />Vou te explicar rapidinho!
      </ChatBubble>
      <ChatBubble side="right" name="Ana (FJN)">
        O plano Pro inclui:<br />• 10.000 atendimentos IA/mês<br />• Disparo em massa<br />• 2 números WhatsApp
      </ChatBubble>
      <ChatBubble side="left" name="Cliente">Quanto custa?</ChatBubble>
      <ChatBubble side="right" name="Ana (FJN)">
        R$ 497/mês, sem fidelidade.<br />Quer testar 14 dias grátis?
      </ChatBubble>
    </div>
  );
}

function ChatBubble({
  side, children, name,
}: { side: "left" | "right"; children: any; name: string }) {
  const isLeft = side === "left";
  return (
    <div className={`flex ${isLeft ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
        isLeft
          ? "bg-navy3 text-light rounded-tl-sm"
          : "bg-orange/10 border border-orange/30 text-light rounded-tr-sm"
      }`}>
        <p className="text-[9px] text-light/40 mb-0.5">{name}</p>
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  );
}

// =====================================================================
// SOCIAL PROOF (placeholder)
// =====================================================================
function SocialProof() {
  return (
    <section className="py-12 border-y border-border bg-navy2/30">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-widest text-gray2 mb-6">
          Construído por quem entende SaaS no Brasil
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 text-light/40 text-sm font-display font-bold">
          <span>STYLOGESTOR</span>
          <span>•</span>
          <span>GYMFLOW</span>
          <span>•</span>
          <span>FJN Tecnologia</span>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// PAIN POINTS
// =====================================================================
function Pain() {
  const pains = [
    { icon: Clock, title: "Perde lead fora do expediente",
      text: "Cliente manda mensagem 22h, sábado, feriado. Você responde segunda. Lead já foi pro concorrente." },
    { icon: Users, title: "Mensagens repetitivas matam o time",
      text: "\"Qual o horário?\" \"Quanto custa?\" \"Tem desconto?\" — 70% do tempo do atendente é em pergunta básica." },
    { icon: BarChart3, title: "Sem dados, sem decisão",
      text: "Quantos leads vieram? Quem comprou? Qual o ticket médio? Sem painel = você chuta." },
  ];
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Reconhece esses problemas?
          </h2>
          <p className="text-light/60 mt-3">É por isso que o FJN Atende existe.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {pains.map((p) => (
            <div key={p.title} className="card p-6">
              <p.icon className="text-orange mb-3" size={28} />
              <h3 className="font-display font-bold text-lg mb-2">{p.title}</h3>
              <p className="text-sm text-light/70">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FEATURES
// =====================================================================
function Features() {
  const features = [
    {
      icon: Bot, title: "IA conversacional humanizada",
      text: "Powered by Claude (Anthropic). Tom natural, lembra do histórico, faz handoff inteligente pra humano quando precisa.",
    },
    {
      icon: MessageSquare, title: "Painel de atendimento em tempo real",
      text: "Acompanha conversas ao vivo, assume bate-papo quando quiser, faz anotações privadas, marca como lead qualificado.",
    },
    {
      icon: Megaphone, title: "Disparo em massa anti-ban",
      text: "Envia campanhas pra listas opt-in. Rate-limit inteligente (10/min), jitter aleatório, opt-out automático.",
    },
    {
      icon: Phone, title: "Suporta múltiplos números",
      text: "1, 2, 5, 20 chips de WhatsApp em uma conta. Cada cliente, segmento ou produto com seu próprio número.",
    },
    {
      icon: Shield, title: "WhatsApp Business API oficial",
      text: "Use o canal próprio (WPP-Connect) ou a API oficial da Meta. Plano Pro+ inclui ambos. Sem risco de banimento.",
    },
    {
      icon: BarChart3, title: "Dashboard com KPIs reais",
      text: "Conversas 24h, leads gerados, handoffs pendentes, ticket médio. Tudo medido, tudo otimizável.",
    },
    {
      icon: Sparkles, title: "Tudo configurável por você",
      text: "Personalidade da IA, dossiês de produtos, regras de handoff, mensagens-modelo. Sem precisar de programador.",
    },
    {
      icon: ShieldCheck, title: "Multi-tenant + LGPD-friendly",
      text: "Dados isolados por conta, criptografia em trânsito, opt-out respeitado. Você confia, seu cliente confia.",
    },
  ];
  return (
    <section id="features" className="py-20 border-t border-border bg-navy3/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Tudo que você precisa em <span className="text-orange">um único painel</span>
          </h2>
          <p className="text-light/60 mt-3 max-w-2xl mx-auto">
            Não é um chatbot de fluxo programado. É IA de verdade respondendo no seu WhatsApp.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon className="text-orange mb-3" size={22} />
              <h3 className="font-display font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-xs text-light/65">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// HOW IT WORKS
// =====================================================================
function HowItWorks() {
  const steps = [
    { n: "1", title: "Crie sua conta grátis",
      text: "Cadastro em 30 segundos. Sem cartão. Acesso completo por 14 dias." },
    { n: "2", title: "Conecte seu WhatsApp",
      text: "Escaneia um QR code. Pronto — IA já começa a responder no seu número." },
    { n: "3", title: "Customize a IA pro seu negócio",
      text: "Define personalidade, produtos, preços, regras. Tudo via painel, sem código." },
    { n: "4", title: "Atenda e venda mais",
      text: "Cliente conversa, IA responde, painel registra. Você acompanha em tempo real e fecha vendas." },
  ];
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Funcionando em <span className="text-orange">5 minutos</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-orange/20 border border-orange/40 flex items-center justify-center font-display font-extrabold text-orange text-xl">
                {s.n}
              </div>
              <h3 className="font-display font-bold mt-4">{s.title}</h3>
              <p className="text-sm text-light/65 mt-2">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// PRICING
// =====================================================================
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "R$ 197",
      desc: "Pra quem está começando",
      features: [
        "2.000 atendimentos IA/mês",
        "1 número de WhatsApp",
        "2 atendentes",
        "Painel completo",
        "Suporte por e-mail",
      ],
      cta: "Começar grátis",
      featured: false,
    },
    {
      name: "Pro",
      price: "R$ 497",
      desc: "Pra negócios em crescimento",
      features: [
        "10.000 atendimentos IA/mês",
        "2 números de WhatsApp",
        "5 atendentes",
        "Disparo em massa (Campanhas)",
        "Meta Cloud API oficial",
        "Templates ilimitados",
        "Suporte prioritário",
      ],
      cta: "Mais popular",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "R$ 997",
      desc: "Pra escala e personalização",
      features: [
        "Atendimentos IA ilimitados",
        "10 números de WhatsApp",
        "20 atendentes",
        "Campanhas + Meta Cloud",
        "White-label (sua marca)",
        "Domínio próprio",
        "Suporte 24/7 + SLA",
        "Implementação assistida",
      ],
      cta: "Falar com vendas",
      featured: false,
    },
  ];
  return (
    <section id="pricing" className="py-20 border-t border-border bg-navy3/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Preço justo, sem surpresa
          </h2>
          <p className="text-light/60 mt-3">
            Cancele a qualquer momento. Sem fidelidade. 14 dias grátis em todos os planos.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`card p-6 relative ${
                p.featured ? "border-orange shadow-glow scale-105" : ""
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange text-navy2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Mais popular
                </div>
              )}
              <h3 className="font-display font-extrabold text-2xl">{p.name}</h3>
              <p className="text-xs text-gray2 mt-1">{p.desc}</p>
              <div className="mt-4">
                <span className="font-display font-extrabold text-4xl text-light">{p.price}</span>
                <span className="text-sm text-gray2">/mês</span>
              </div>
              <ul className="mt-6 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={14} className="text-orange shrink-0 mt-0.5" />
                    <span className="text-light/85">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`mt-6 block text-center py-2.5 rounded-lg font-bold ${
                p.featured ? "bg-orange text-navy2 hover:bg-orange2" : "border border-border hover:border-orange/40"
              }`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray2 mt-8">
          💡 Disparo em massa cobra créditos separados (pay-per-use). R$ 0,03/mensagem WPP-Connect ou R$ 0,15/msg Meta oficial.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// USE CASES
// =====================================================================
function UseCases() {
  const cases = [
    { icon: "💈", title: "Barbearias & salões",
      text: "Cliente marca, remarca e confirma agendamento sozinho. Sem furo de agenda." },
    { icon: "🏋️", title: "Academias & estúdios",
      text: "Captura matrícula, envia lembrete de pagamento, reengaja aluno sumido." },
    { icon: "🏠", title: "Imobiliárias",
      text: "Qualifica lead, envia ficha do imóvel, agenda visita com corretor humano." },
    { icon: "⚕️", title: "Clínicas",
      text: "Triagem inicial, agendamento, lembrete de consulta, follow-up pós-procedimento." },
    { icon: "🍔", title: "Restaurantes & delivery",
      text: "Recebe pedido, tira dúvida do cardápio, informa entrega, coleta avaliação." },
    { icon: "🛍️", title: "E-commerce & dropshipping",
      text: "Atende dúvida do produto, status do pedido, problema de entrega — 24/7." },
  ];
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Funciona em <span className="text-orange">qualquer negócio</span> com WhatsApp
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {cases.map((c) => (
            <div key={c.title} className="card p-5">
              <div className="text-3xl mb-2">{c.icon}</div>
              <h3 className="font-display font-bold mb-1">{c.title}</h3>
              <p className="text-sm text-light/65">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FAQ
// =====================================================================
function FAQ() {
  const faqs = [
    {
      q: "Vai banir meu número de WhatsApp?",
      a: "Não, se você seguir as boas práticas. A IA responde dentro do volume normal de uso. Pra disparo em massa, temos rate-limit anti-ban (10msgs/min com variação) e a opção de usar a API oficial da Meta no plano Pro+, que tem garantia 100% contra banimento.",
    },
    {
      q: "Quanto tempo leva pra começar?",
      a: "5 minutos. Cria a conta, escaneia o QR do seu WhatsApp, customiza a personalidade da IA (você passa o que vende e como atende), e pronto. Comece a usar imediatamente.",
    },
    {
      q: "A IA realmente parece humana?",
      a: "Sim. Usamos o Claude da Anthropic, uma das melhores IAs do mundo. Você pode customizar tom (formal, descontraído, brasileiro, etc), nome do \"atendente\", regras de quando passar pra humano. A maioria dos clientes não percebe que é IA.",
    },
    {
      q: "E se a IA não souber responder algo?",
      a: "Configurável. Por padrão, ela passa pra você (handoff) com uma notificação no painel. Você pode definir regras: \"sempre que falar de cancelamento, passa pra mim\", \"se for sobre pagamento, transfere\", etc.",
    },
    {
      q: "Preciso de cartão de crédito pra testar?",
      a: "Não. 14 dias grátis sem cartão. No fim do período, você decide qual plano quer.",
    },
    {
      q: "Posso usar meu número atual?",
      a: "Sim, mas recomendamos um número dedicado pra atendimento (chip novo). Assim seu WhatsApp pessoal não fica misturado e você pode dar o número FJN no site, redes sociais, cartão de visita.",
    },
    {
      q: "Quantas mensagens estão incluídas?",
      a: "Atendimento via IA: Starter 2.000/mês, Pro 10.000/mês, Enterprise ilimitado. Excedente custa centavos. Disparo em massa é separado (pay-per-use, recarga via PIX).",
    },
    {
      q: "Posso cancelar quando quiser?",
      a: "Sim, sem fidelidade. Cancela com 1 clique no painel. Mantém acesso até fim do mês pago. Sem multa, sem ligação pra retenção.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 border-t border-border bg-navy3/30">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Perguntas frequentes
          </h2>
        </div>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-white/3 transition-colors"
              >
                <span className="font-display font-bold text-sm md:text-base pr-4">{f.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-orange transition-transform shrink-0 ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-light/75 leading-relaxed">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FINAL CTA
// =====================================================================
function FinalCTA() {
  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="card p-10 md:p-14 text-center bg-gradient-to-br from-orange/10 to-navy3 border-orange/40">
          <Star className="mx-auto text-orange mb-4" size={32} />
          <h2 className="font-display font-extrabold text-3xl md:text-5xl">
            Comece a vender mais <span className="text-orange">hoje</span>
          </h2>
          <p className="text-light/70 mt-4 max-w-2xl mx-auto">
            14 dias grátis. Sem cartão. Setup em 5 minutos. Suporte humano se precisar.
          </p>
          <Link href="/signup" className="btn-primary mt-8 inline-flex items-center gap-2 text-base px-8 py-3">
            Criar conta grátis agora
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FOOTER
// =====================================================================
function Footer() {
  return (
    <footer className="border-t border-border py-10 bg-navy2/50">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-6 text-sm">
        <div>
          <div className="font-display font-extrabold mb-2">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </div>
          <p className="text-light/60 text-xs">
            Atendimento WhatsApp com IA. Construído pela FJN Tecnologia.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-widest text-gray2 mb-3">Produto</h4>
          <ul className="space-y-1.5 text-light/70">
            <li><a href="#features" className="hover:text-orange">Recursos</a></li>
            <li><a href="#pricing" className="hover:text-orange">Planos</a></li>
            <li><a href="#faq" className="hover:text-orange">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-widest text-gray2 mb-3">Conta</h4>
          <ul className="space-y-1.5 text-light/70">
            <li><Link href="/signup" className="hover:text-orange">Criar conta</Link></li>
            <li><Link href="/login" className="hover:text-orange">Entrar</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-widest text-gray2 mb-3">Contato</h4>
          <ul className="space-y-1.5 text-light/70">
            <li><a href="mailto:fjntecnologia2022@gmail.com" className="hover:text-orange">fjntecnologia2022@gmail.com</a></li>
            <li><a href="https://wa.me/5565980900089" className="hover:text-orange">WhatsApp: (65) 98090-0089</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-3 text-xs text-gray2">
        <p>© {new Date().getFullYear()} FJN Tecnologia. Todos os direitos reservados.</p>
        <p>Made with 🧡 em Cuiabá-MT</p>
      </div>
    </footer>
  );
}
