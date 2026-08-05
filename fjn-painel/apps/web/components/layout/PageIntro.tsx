"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Info, X, BookOpen } from "lucide-react";

interface PageIntroProps {
  /** Título curto — "Como funciona o Funil" */
  title: string;
  /** Descrição de 1-2 linhas do que a tela faz */
  description: string;
  /** Lista opcional de passos/dicas (bullets) */
  steps?: string[];
  /** Link pra artigo da Ajuda relacionado (opcional) */
  helpArticle?: {
    slug: string;
    label: string;
  };
  /** Chave única — se usuário fechou, não mostra mais (localStorage) */
  storageKey: string;
  /** Se true, começa aberto mesmo se antes foi fechado */
  forceOpen?: boolean;
}

/**
 * Card contextual no topo da tela explicando o que aquela página faz.
 * - Usuário pode fechar clicando no X
 * - Estado salvo em localStorage (não mostra de novo)
 * - Link opcional pra artigo da Ajuda com mais detalhes
 */
export function PageIntro({
  title, description, steps, helpArticle, storageKey, forceOpen,
}: PageIntroProps) {
  const [dismissed, setDismissed] = useState(true);  // começa oculto pra evitar flash

  useEffect(() => {
    if (forceOpen) {
      setDismissed(false);
      return;
    }
    // Só mostra se usuário nunca fechou
    const key = `page-intro:${storageKey}`;
    const wasDismissed = localStorage.getItem(key) === "1";
    setDismissed(wasDismissed);
  }, [storageKey, forceOpen]);

  function dismiss() {
    localStorage.setItem(`page-intro:${storageKey}`, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="card p-4 bg-orange/5 border-orange/30 relative mb-6">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-gray2 hover:text-light p-1"
        title="Fechar (não mostrar mais)"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="p-2 rounded-lg bg-orange/15 flex-shrink-0">
          <Info size={16} className="text-orange" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-light text-sm mb-1">{title}</h3>
          <p className="text-xs text-light/80 leading-relaxed">{description}</p>

          {steps && steps.length > 0 && (
            <ol className="mt-3 space-y-1 text-xs text-light/70 list-decimal list-inside">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}

          {helpArticle && (
            <Link
              href={`/ajuda/${helpArticle.slug}`}
              className="inline-flex items-center gap-1 mt-3 text-xs text-orange hover:underline font-bold"
            >
              <BookOpen size={12} />
              {helpArticle.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
