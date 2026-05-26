"use client";

import { Package } from "lucide-react";

const produtos = [
  {
    nome: "STYLOGESTOR",
    desc: "SaaS de gestão para barbearias e salões de beleza",
    status: "Em desenvolvimento",
    cor: "from-blue-500/20 to-orange/20 border-blue-500/30",
    tags: ["SaaS", "Beleza", "Multi-tenant"],
  },
  {
    nome: "GYMFLOW",
    desc: "SaaS de gestão para academias e estúdios fitness",
    status: "MVP em desenvolvimento",
    cor: "from-orange/20 to-green-500/20 border-orange/30",
    tags: ["SaaS", "Fitness", "Catraca"],
  },
  {
    nome: "FJN Desenvolvimento",
    desc: "Serviços de desenvolvimento sob demanda — sites, sistemas, automações",
    status: "Operação ativa",
    cor: "from-orange/20 to-navy3 border-orange/30",
    tags: ["Serviço", "Custom", "Consultoria"],
  },
];

export default function ProdutosPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          <Package className="text-orange" />
          Produtos & Serviços
        </h1>
        <p className="text-sm text-gray2 mt-1">
          Portfólio da FJN Tecnologia que a IA atende
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {produtos.map((p) => (
          <div
            key={p.nome}
            className={`card p-6 bg-gradient-to-br ${p.cor} hover:shadow-glow transition-shadow`}
          >
            <h3 className="font-display font-extrabold text-xl text-light">{p.nome}</h3>
            <p className="text-sm text-light/70 mt-2 mb-4">{p.desc}</p>

            <p className="label mb-1">Status</p>
            <p className="text-sm font-semibold text-orange mb-4">{p.status}</p>

            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-bold uppercase tracking-widest text-light/60 border border-border px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <p className="text-sm text-gray2">
          Para editar o que a IA sabe sobre cada produto, vá em{" "}
          <span className="text-orange font-semibold">Config IA</span> e abra o dossiê correspondente.
        </p>
      </div>
    </div>
  );
}
