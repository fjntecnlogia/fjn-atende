"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, Search, MessageCircle, Phone, Mail } from "lucide-react";
import { CATEGORIES, articlesByCategory, ARTICLES } from "./_data/articles";

export default function AjudaPage() {
  const [search, setSearch] = useState("");
  const grouped = articlesByCategory();

  // Filtra artigos quando há busca
  const filtered = search.trim()
    ? ARTICLES.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.body.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center">
        <HelpCircle className="text-orange mx-auto mb-3" size={40} />
        <h1 className="font-display text-4xl font-extrabold">Central de Ajuda</h1>
        <p className="text-gray2 mt-2">
          Tutoriais, dúvidas frequentes e dicas pra extrair o máximo do FJN Atende
        </p>
      </div>

      {/* Busca */}
      <div className="relative max-w-xl mx-auto">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray2" />
        <input
          className="input w-full pl-11 py-3"
          placeholder="Buscar tutorial ou dúvida..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Resultados da busca */}
      {filtered ? (
        <div className="space-y-2">
          <p className="text-xs text-gray2 uppercase tracking-widest font-bold">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} pra "{search}"
          </p>
          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray2">Nada encontrado. Tenta outras palavras ou nos chama no WhatsApp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((a) => (
                <Link key={a.slug} href={`/ajuda/${a.slug}`}
                      className="card p-4 hover:border-orange/40 transition-colors block">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-orange mb-1">
                    {CATEGORIES[a.category].emoji} {CATEGORIES[a.category].label}
                  </p>
                  <p className="font-bold text-light text-sm">{a.title}</p>
                  <p className="text-xs text-gray2 mt-1">{a.description}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Categorias */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((cat) => {
            const cfg = CATEGORIES[cat];
            const articles = grouped[cat];
            return (
              <div key={cat} className="card p-5 hover:border-orange/40 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div>
                    <h2 className="font-display font-bold text-lg text-light">{cfg.label}</h2>
                    <p className="text-xs text-gray2">{cfg.description}</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {articles.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/ajuda/${a.slug}`}
                            className="text-sm text-light/80 hover:text-orange transition-colors block py-1">
                        → {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Card de suporte */}
      <div className="card p-6 bg-orange/5 border-orange/30">
        <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <MessageCircle className="text-orange" size={18} />
          Não achou o que procurava?
        </h3>
        <p className="text-sm text-light/80 mb-4">
          Nossa equipe responde em até 1 dia útil.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="https://wa.me/5565980900089" target="_blank" rel="noreferrer"
             className="btn-primary flex items-center gap-2">
            <Phone size={14} /> WhatsApp (65) 98090-0089
          </a>
          <a href="mailto:fjntecnologia2022@gmail.com"
             className="btn-ghost flex items-center gap-2">
            <Mail size={14} /> fjntecnologia2022@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
