"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface Step {
  label: string;
  desc?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  steps?: Step[];
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondaryLink?: {
    label: string;
    href: string;
  };
}

/**
 * Empty state visual pra telas sem dados.
 * Ícone grande + título + descrição + steps opcionais + CTA + link secundário.
 */
export function EmptyState({
  icon: Icon, title, description, steps, cta, secondaryLink,
}: EmptyStateProps) {
  const CtaIcon = cta?.icon;
  const CtaButton = () => (
    <>
      {CtaIcon && <CtaIcon size={16} />}
      {cta?.label}
    </>
  );

  return (
    <div className="card p-12 text-center max-w-2xl mx-auto">
      <div className="inline-block p-4 rounded-full bg-orange/15 mb-4">
        <Icon size={40} className="text-orange" />
      </div>
      <h2 className="font-display text-2xl font-extrabold text-light mb-2">{title}</h2>
      <p className="text-sm text-gray2 mb-6">{description}</p>

      {steps && steps.length > 0 && (
        <div className="text-left max-w-md mx-auto mb-6 space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange/20 text-orange flex items-center justify-center font-bold text-xs flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <p className="text-sm text-light font-semibold">{s.label}</p>
                {s.desc && <p className="text-xs text-gray2 mt-0.5">{s.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {cta && (
        cta.href ? (
          <Link href={cta.href} className="btn-primary inline-flex items-center gap-2">
            <CtaButton />
          </Link>
        ) : (
          <button onClick={cta.onClick} className="btn-primary inline-flex items-center gap-2">
            <CtaButton />
          </button>
        )
      )}

      {secondaryLink && (
        <div className="mt-4">
          <Link href={secondaryLink.href} className="text-xs text-gray2 hover:text-orange">
            {secondaryLink.label}
          </Link>
        </div>
      )}
    </div>
  );
}
