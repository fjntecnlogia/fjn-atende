"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalPage({
  title,
  subtitle,
  lastUpdated,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy2 text-light">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display font-extrabold tracking-tight text-lg">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </Link>
          <Link href="/" className="text-sm text-light/70 hover:text-orange flex items-center gap-1">
            <ArrowLeft size={14} /> Voltar
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display font-extrabold text-3xl md:text-5xl">{title}</h1>
        {subtitle && <p className="text-light/70 mt-3 text-lg">{subtitle}</p>}
        <p className="text-xs text-gray2 mt-4">
          Última atualização: <strong>{lastUpdated}</strong>
        </p>

        <div className="prose-fjn mt-10">{children}</div>

        {/* CTA volta */}
        <div className="mt-16 pt-8 border-t border-border text-sm text-gray2">
          <p>
            Dúvidas? Fale com a gente em{" "}
            <a href="mailto:fjntecnologia2022@gmail.com" className="text-orange hover:underline">
              fjntecnologia2022@gmail.com
            </a>
          </p>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-navy2/50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-2 text-xs text-gray2">
          <p>© {new Date().getFullYear()} FJN Tecnologia. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/termos" className="hover:text-orange">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-orange">Privacidade</Link>
          </div>
        </div>
      </footer>

      {/* Estilos prose customizados */}
      <style jsx global>{`
        .prose-fjn h2 {
          font-family: "Barlow Condensed", sans-serif;
          font-weight: 800;
          font-size: 1.75rem;
          color: #FFBA00;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }
        .prose-fjn h3 {
          font-family: "Barlow Condensed", sans-serif;
          font-weight: 700;
          font-size: 1.25rem;
          color: #F4F6FF;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
        }
        .prose-fjn p {
          color: rgba(244, 246, 255, 0.8);
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .prose-fjn ul, .prose-fjn ol {
          color: rgba(244, 246, 255, 0.8);
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .prose-fjn li { margin-bottom: 0.4rem; }
        .prose-fjn strong { color: #F4F6FF; font-weight: 700; }
        .prose-fjn code {
          background: rgba(255, 186, 0, 0.1);
          border: 1px solid rgba(255, 186, 0, 0.3);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.875rem;
          color: #FFBA00;
        }
        .prose-fjn a { color: #FFBA00; text-decoration: underline; }
        .prose-fjn a:hover { color: #E0A000; }
      `}</style>
    </div>
  );
}
