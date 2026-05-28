"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { ARTICLES, CATEGORIES } from "../_data/articles";

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = ARTICLES.find((a) => a.slug === params.slug);

  if (!article) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <h1 className="font-display text-2xl font-bold">Artigo não encontrado</h1>
        <Link href="/ajuda" className="btn-primary inline-block">Voltar pra Central de Ajuda</Link>
      </div>
    );
  }

  const cat = CATEGORIES[article.category];
  const relatedArticles = article.related
    ? article.related.map((slug) => ARTICLES.find((a) => a.slug === slug)).filter(Boolean) as typeof ARTICLES
    : [];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <Link href="/ajuda" className="text-sm text-gray2 hover:text-light flex items-center gap-1">
        <ArrowLeft size={14} /> Central de Ajuda
      </Link>

      <div>
        <p className="text-xs uppercase tracking-widest font-bold text-orange mb-2">
          {cat.emoji} {cat.label}
        </p>
        <h1 className="font-display text-3xl font-extrabold text-light">{article.title}</h1>
        <p className="text-gray2 mt-2">{article.description}</p>
      </div>

      <article
        className="prose-fjn"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />

      {relatedArticles.length > 0 && (
        <div className="card p-5 mt-8">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-gray2 mb-3">
            Artigos relacionados
          </h3>
          <ul className="space-y-2">
            {relatedArticles.map((a) => (
              <li key={a.slug}>
                <Link href={`/ajuda/${a.slug}`}
                      className="text-light hover:text-orange transition-colors flex items-center gap-2">
                  → {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5 bg-orange/5 border-orange/30 mt-8">
        <p className="text-sm text-light/80 flex items-center gap-2">
          <MessageCircle size={14} className="text-orange flex-shrink-0" />
          <span>
            Ainda com dúvida? Nos chama no WhatsApp{" "}
            <a href="https://wa.me/5565980900089" target="_blank" rel="noreferrer"
               className="text-orange font-bold hover:underline">
              (65) 98090-0089
            </a>
          </span>
        </p>
      </div>

      <style jsx global>{`
        .prose-fjn h2 {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 1.5rem;
          color: #FFBA00;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .prose-fjn p {
          color: rgba(244, 246, 255, 0.85);
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .prose-fjn ul, .prose-fjn ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
          color: rgba(244, 246, 255, 0.85);
        }
        .prose-fjn li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }
        .prose-fjn ul { list-style: disc; }
        .prose-fjn ol { list-style: decimal; }
        .prose-fjn strong {
          color: #F4F6FF;
          font-weight: 700;
        }
        .prose-fjn a {
          color: #FFBA00;
          text-decoration: underline;
        }
        .prose-fjn code {
          background: #060C28;
          color: #FFBA00;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.875em;
        }
        .prose-fjn pre {
          background: #060C28;
          border: 1px solid #1A2358;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .prose-fjn pre code {
          background: transparent;
          padding: 0;
          color: #F4F6FF;
        }
      `}</style>
    </div>
  );
}
