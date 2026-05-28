/**
 * Conteúdo da Central de Ajuda — artigos categorizados.
 *
 * Pra adicionar artigo novo: insere objeto neste array.
 * Pra editar: só mudar a string.
 */

export interface Article {
  slug: string;
  title: string;
  category: ArticleCategory;
  description: string;
  body: string;  // pode conter HTML simples (h2, p, ul, code)
  related?: string[];  // slugs de artigos relacionados
}

export type ArticleCategory =
  | "comecar"
  | "whatsapp"
  | "ia"
  | "funil"
  | "campanhas"
  | "planos"
  | "whitelabel";

export const CATEGORIES: Record<ArticleCategory, { label: string; emoji: string; description: string }> = {
  comecar:    { label: "Começar",          emoji: "🚀", description: "Primeiros passos no FJN Atende" },
  whatsapp:   { label: "WhatsApp",         emoji: "📱", description: "Conectar e gerenciar instâncias" },
  ia:         { label: "IA",               emoji: "🤖", description: "Configurar e personalizar a IA" },
  funil:      { label: "Funil",            emoji: "📊", description: "Kanban, times e métricas" },
  campanhas:  { label: "Campanhas",        emoji: "📣", description: "Disparo em massa anti-ban" },
  planos:     { label: "Planos & Créditos", emoji: "💳", description: "Assinatura, créditos e cotas" },
  whitelabel: { label: "White-label",      emoji: "🎨", description: "Personalizar marca (Pro+)" },
};

export const ARTICLES: Article[] = [
  // =====================================================================
  // COMEÇAR
  // =====================================================================
  {
    slug: "bem-vindo",
    title: "Bem-vindo ao FJN Atende",
    category: "comecar",
    description: "O que é o FJN Atende e como ele funciona",
    body: `
      <h2>O que é?</h2>
      <p>O <strong>FJN Atende</strong> é uma plataforma SaaS de atendimento via WhatsApp com IA Claude.
        Ele responde seus clientes 24/7, qualifica leads, organiza tudo num funil de vendas e
        ainda dispara campanhas em massa.</p>

      <h2>Como funciona</h2>
      <ol>
        <li><strong>Conecta seu WhatsApp Business</strong> — escaneia um QR code</li>
        <li><strong>Configura a IA</strong> — diz como ela deve atender (tom, produtos, regras)</li>
        <li><strong>Pronto</strong> — IA responde, qualifica, cria card no funil, te passa quando importante</li>
      </ol>

      <h2>Pra quem é?</h2>
      <ul>
        <li>Empresas que recebem muitas mensagens de WhatsApp</li>
        <li>Quem quer escalar atendimento sem contratar mais gente</li>
        <li>Times de vendas que precisam de funil organizado</li>
        <li>Agências que querem revender (white-label)</li>
      </ul>
    `,
    related: ["primeiros-passos", "diferenca-pro-pro-plus"],
  },
  {
    slug: "primeiros-passos",
    title: "Primeiros passos — checklist de setup",
    category: "comecar",
    description: "5 passos pra deixar tudo rodando em ~30 minutos",
    body: `
      <h2>Checklist de 5 passos</h2>
      <ol>
        <li><strong>Escolha um plano</strong> em <a href="/planos">/planos</a> — sem assinatura, o sistema fica bloqueado</li>
        <li><strong>Conecte o WhatsApp</strong> em <a href="/whatsapp">/whatsapp</a> — escaneia o QR code</li>
        <li><strong>Configure a IA</strong> em <a href="/config">/config</a> — defina persona, produtos, regras</li>
        <li><strong>Crie seu funil</strong> em <a href="/funis">/funis</a> — etapas customizadas pro seu processo</li>
        <li><strong>(Opcional) Equipe</strong> em <a href="/times">/times</a> — convida atendentes</li>
      </ol>
      <p><strong>Tempo total:</strong> 20-30 minutos. Depois disso, a IA já está atendendo.</p>
    `,
    related: ["bem-vindo", "como-conectar-whatsapp"],
  },
  {
    slug: "diferenca-pro-pro-plus",
    title: "Diferença entre Pro e Pro+",
    category: "comecar",
    description: "Qual plano escolher e quando fazer upgrade",
    body: `
      <h2>Pro (R$ 99/mês)</h2>
      <ul>
        <li>1 instância WhatsApp</li>
        <li>Até 3 usuários</li>
        <li>1 funil de atendimento</li>
        <li>1.000 mensagens IA/mês</li>
        <li>Suporte por e-mail</li>
      </ul>

      <h2>Pro+ (R$ 299/mês)</h2>
      <ul>
        <li>3 instâncias WhatsApp</li>
        <li>Até 10 usuários</li>
        <li>Múltiplos funis (Comercial, Suporte, etc)</li>
        <li><strong>Times com round-robin</strong></li>
        <li>5.000 mensagens IA/mês</li>
        <li>Métricas avançadas (forecast, conversão)</li>
        <li>White-label parcial (logo + cores)</li>
        <li>Acesso à API</li>
        <li>Suporte prioritário</li>
      </ul>

      <h2>Anual</h2>
      <p>Os 2 planos têm versão anual com <strong>20% off</strong>:</p>
      <ul>
        <li>Pro Anual: R$ 950/ano (=R$ 79/mês)</li>
        <li>Pro+ Anual: R$ 2.870/ano (=R$ 239/mês)</li>
      </ul>

      <h2>Excedente</h2>
      <p>Estourou cota mensal? Sistema cobra do <strong>crédito pré-pago</strong> (R$ 0,03/mensagem extra).
        Recarregue em <a href="/creditos/comprar">/creditos/comprar</a>.</p>
    `,
    related: ["como-funcionam-planos", "comprar-credito"],
  },

  // =====================================================================
  // WHATSAPP
  // =====================================================================
  {
    slug: "como-conectar-whatsapp",
    title: "Como conectar seu WhatsApp Business",
    category: "whatsapp",
    description: "Passo a passo do QR code à primeira mensagem",
    body: `
      <h2>Pré-requisito</h2>
      <p>Você precisa de um <strong>chip dedicado</strong> e o WhatsApp Business instalado.
        Não use o número pessoal — ele pode ser banido por uso automatizado.</p>

      <h2>Passo a passo</h2>
      <ol>
        <li>No painel, vai em <a href="/whatsapp">/whatsapp</a></li>
        <li>Clica em <strong>Criar nova instância</strong></li>
        <li>Dê um nome (ex: "Vendas") e salva</li>
        <li>Clica em <strong>Gerar QR Code</strong></li>
        <li>No celular: WhatsApp Business → Menu → Dispositivos conectados → Conectar dispositivo</li>
        <li>Escaneia o QR code que aparece no painel</li>
        <li>Aguarda 10-20 segundos → status muda pra "Conectado"</li>
      </ol>

      <h2>Pronto!</h2>
      <p>A partir desse momento, qualquer mensagem que chegar no número vai ser processada pela IA
        e aparecer no painel em <a href="/conversas">/conversas</a>.</p>
    `,
    related: ["reconectar-whatsapp", "configurar-persona-ia"],
  },
  {
    slug: "reconectar-whatsapp",
    title: "Como reconectar quando desconecta",
    category: "whatsapp",
    description: "WhatsApp caiu? Como restaurar em 1 minuto",
    body: `
      <h2>Quando acontece</h2>
      <p>O WhatsApp Business pode desconectar do FJN Atende quando:</p>
      <ul>
        <li>Você fica mais de 14 dias sem abrir o WhatsApp no celular</li>
        <li>Trocou o celular ou reinstalou o app</li>
        <li>WhatsApp atualizou e pediu re-login</li>
      </ul>

      <h2>Como reconectar</h2>
      <ol>
        <li>Vai em <a href="/whatsapp">/whatsapp</a></li>
        <li>Na instância que ficou vermelha (Desconectada), clica em <strong>Reconectar</strong></li>
        <li>Escaneia o QR code novamente</li>
      </ol>

      <p><strong>Importante:</strong> mensagens que chegaram durante a desconexão <strong>não são recuperadas</strong>.
        Tente verificar diariamente.</p>
    `,
    related: ["como-conectar-whatsapp"],
  },

  // =====================================================================
  // IA
  // =====================================================================
  {
    slug: "configurar-persona-ia",
    title: "Configurar persona da IA",
    category: "ia",
    description: "Defina como a IA atende seus clientes",
    body: `
      <h2>Por que personalizar?</h2>
      <p>A IA Claude é poderosa, mas se não souber sobre seu negócio, vai responder de forma genérica.
        Quanto mais informação você der, melhor o atendimento.</p>

      <h2>O que configurar (em <a href="/config">/config</a>)</h2>
      <ul>
        <li><strong>Nome da assistente</strong> — ex: "Joana", "Atendente Bia"</li>
        <li><strong>Tom de voz</strong> — formal? caloroso? direto? brincalhão?</li>
        <li><strong>Produtos e serviços</strong> — lista do que você vende, com preços</li>
        <li><strong>Regras</strong> — ex: "se perguntarem sobre delivery, responder que entregamos em até 30min na zona sul"</li>
        <li><strong>Horário</strong> — quando a IA deve atender e quando deve dizer "voltamos amanhã"</li>
      </ul>

      <h2>Dica de ouro</h2>
      <p>Faça testes mandando mensagens pro seu próprio número de outro celular.
        Se a IA respondeu errado, ajusta o prompt em <a href="/config">/config</a> e testa de novo.</p>
    `,
    related: ["quando-ia-encaminha-humano", "como-conectar-whatsapp"],
  },
  {
    slug: "quando-ia-encaminha-humano",
    title: "Quando a IA encaminha pra humano (handoff)",
    category: "ia",
    description: "Entenda as regras de transferência automática",
    body: `
      <h2>O que é handoff?</h2>
      <p>É quando a IA percebe que <strong>precisa de um humano</strong> e pausa o atendimento automático,
        notificando você em <a href="/handoffs">/handoffs</a>.</p>

      <h2>Quando acontece automaticamente</h2>
      <ul>
        <li>Cliente pede explicitamente pra falar com humano</li>
        <li>IA não sabe responder algo crítico (ex: pedido de reembolso)</li>
        <li>Cliente parece muito irritado</li>
        <li>Negociação complexa de preço/prazo</li>
      </ul>

      <h2>Como você responde</h2>
      <ol>
        <li>Recebe notificação no painel</li>
        <li>Abre a conversa em <a href="/conversas">/conversas</a></li>
        <li>Manda mensagem direto (vai com seu nome)</li>
        <li>Quando terminar, clica em "Devolver pra IA" pra reativar</li>
      </ol>
    `,
    related: ["configurar-persona-ia"],
  },

  // =====================================================================
  // FUNIL
  // =====================================================================
  {
    slug: "o-que-e-funil",
    title: "O que é o Funil de Atendimento",
    category: "funil",
    description: "Visualize todas conversas em um Kanban",
    body: `
      <h2>Conceito</h2>
      <p>Cada conversa que chega no WhatsApp vira automaticamente um <strong>card</strong>
        no Kanban do funil. Você arrasta entre etapas (Novo → Qualificando → Proposta → Ganho).</p>

      <h2>Etapas padrão</h2>
      <ol>
        <li><strong>Novo</strong> — acabou de chegar, IA respondendo</li>
        <li><strong>Qualificando</strong> — IA descobrindo o que cliente precisa</li>
        <li><strong>Proposta enviada</strong> — orçamento mandado</li>
        <li><strong>Negociação</strong> — discutindo termos</li>
        <li><strong>Ganho</strong> — fechou venda 🏆</li>
        <li><strong>Perdido</strong> — não fechou (com motivo)</li>
      </ol>

      <h2>Customização</h2>
      <p>Você pode editar etapas, criar novas, mudar cores e até criar <strong>múltiplos funis</strong>
        (Pro+) pra diferentes processos: Comercial, Suporte, Pós-venda, etc.</p>
    `,
    related: ["criar-pipeline", "times-atendimento"],
  },
  {
    slug: "criar-pipeline",
    title: "Criar funis customizados (Pro+)",
    category: "funil",
    description: "Múltiplos pipelines pra processos diferentes",
    body: `
      <h2>Quando criar mais de um funil</h2>
      <ul>
        <li>Vendas vs Suporte vs Pós-venda</li>
        <li>Produtos diferentes com processos distintos</li>
        <li>Time de pré-venda vs time de fechamento</li>
      </ul>

      <h2>Como criar</h2>
      <ol>
        <li>Em <a href="/funis">/funis</a>, clica em <strong>Novo funil</strong></li>
        <li>Dá um nome (ex: "Suporte") e escolhe cor</li>
        <li>Clica em <strong>Abrir Kanban</strong></li>
        <li>Edita etapas conforme seu processo</li>
      </ol>

      <h2>Como uma conversa entra em vários funis?</h2>
      <p>Por padrão, conversa entra só no <strong>funil padrão</strong> (estrela ⭐).
        Pra adicionar a outro funil, abre a conversa em <a href="/conversas">/conversas</a> e usa o seletor
        na sidebar direita pra escolher o pipeline.</p>
    `,
    related: ["o-que-e-funil", "times-atendimento"],
  },
  {
    slug: "times-atendimento",
    title: "Times de atendimento e round-robin",
    category: "funil",
    description: "Distribua conversas automaticamente entre atendentes",
    body: `
      <h2>O que é</h2>
      <p>Times são grupos de atendentes (ex: "Comercial", "Suporte 24h").
        Quando uma conversa nova entra, o sistema pode atribuir automaticamente
        a alguém do time.</p>

      <h2>3 estratégias de atribuição</h2>
      <ul>
        <li><strong>Manual</strong> — atendente pega o que quer</li>
        <li><strong>Round-robin</strong> — sistema distribui equilibrado (cada um recebe na vez)</li>
        <li><strong>Menos ocupado</strong> — vai pra quem tem menos cards abertos</li>
      </ul>

      <h2>Como configurar</h2>
      <ol>
        <li>Em <a href="/times">/times</a>, clica em <strong>Novo time</strong></li>
        <li>Escolhe estratégia (recomendo round-robin pra começar)</li>
        <li>Adiciona membros do time pelo seletor</li>
      </ol>
    `,
    related: ["criar-pipeline"],
  },

  // =====================================================================
  // CAMPANHAS
  // =====================================================================
  {
    slug: "fazer-campanha",
    title: "Como fazer uma campanha de disparo",
    category: "campanhas",
    description: "Mandar mensagens em massa de forma segura",
    body: `
      <h2>Passo a passo</h2>
      <ol>
        <li>Vai em <a href="/campanhas/listas">/campanhas/listas</a> e <strong>importa uma lista</strong> (CSV com colunas: phone, name)</li>
        <li>Em <a href="/campanhas/templates">/campanhas/templates</a> cria um template com a mensagem (pode usar {{name}} pra personalizar)</li>
        <li>Em <a href="/campanhas/nova">/campanhas/nova</a> conecta lista + template + agenda</li>
        <li>Define <strong>rate limit</strong> (recomendo 10 mensagens/minuto pra ficar seguro)</li>
        <li>Inicia</li>
      </ol>

      <h2>Anti-ban</h2>
      <p>O FJN Atende já protege seu número assim:</p>
      <ul>
        <li>Rate limit configurável (10/min é o padrão seguro)</li>
        <li>Jitter (espaçamento aleatório entre envios)</li>
        <li>Auto-pause se taxa de falha passar de 20%</li>
        <li>Opt-out automático (cliente respondeu PARAR/SAIR/CANCELAR → tirado da lista)</li>
      </ul>

      <p><strong>Importante:</strong> só dispara pra quem <strong>autorizou</strong>. Spam pode banir seu número
        permanentemente do WhatsApp.</p>
    `,
    related: ["importar-csv", "opt-out"],
  },
  {
    slug: "importar-csv",
    title: "Importar lista de contatos via CSV",
    category: "campanhas",
    description: "Formato esperado e dicas de qualidade",
    body: `
      <h2>Formato do CSV</h2>
      <p>O arquivo precisa ter <strong>cabeçalho</strong> e pelo menos a coluna <code>phone</code>:</p>

      <pre><code>phone,name,empresa
5511987654321,João Silva,Acme Ltda
5511912345678,Maria Souza,XYZ Co</code></pre>

      <h2>Regras dos telefones</h2>
      <ul>
        <li>Sempre com código do país (Brasil: 55)</li>
        <li>Sem espaços, hífens ou parênteses</li>
        <li>Inclui o 9 dos celulares</li>
        <li>Ex válido: <code>5511987654321</code></li>
        <li>Ex inválido: <code>(11) 98765-4321</code></li>
      </ul>

      <h2>Variáveis no template</h2>
      <p>Qualquer coluna além de <code>phone</code> vira variável usável no template:</p>
      <ul>
        <li><code>{{name}}</code> — pega da coluna name</li>
        <li><code>{{empresa}}</code> — pega da coluna empresa</li>
        <li>Se coluna não existe, fica em branco</li>
      </ul>

      <p>Exemplo: <em>"Olá {{name}}! Tudo bem na {{empresa}}?"</em></p>
    `,
    related: ["fazer-campanha", "opt-out"],
  },
  {
    slug: "opt-out",
    title: "Opt-out automático (PARAR/SAIR)",
    category: "campanhas",
    description: "Como o sistema respeita pedidos de descadastro",
    body: `
      <h2>O que é</h2>
      <p>Quando um destinatário responde palavras como <strong>PARAR, SAIR, CANCELAR, STOP, UNSUBSCRIBE</strong>,
        o FJN Atende detecta automaticamente e:</p>
      <ul>
        <li>Marca o contato como opt-out em TODAS as suas listas</li>
        <li>Cancela envios pendentes pra ele em campanhas em andamento</li>
        <li>Manda confirmação automática: "Você foi removido. Não receberá mais nossas mensagens."</li>
        <li>Registra no <a href="/campanhas/optouts">log de opt-outs</a> com data e motivo</li>
      </ul>

      <h2>Por que isso é importante</h2>
      <ul>
        <li><strong>Legal (LGPD)</strong> — direito do titular de revogar consentimento</li>
        <li><strong>Anti-ban</strong> — WhatsApp banneia números que ignoram pedidos de descadastro</li>
        <li><strong>Reputação</strong> — ninguém quer ser perseguido por spam</li>
      </ul>
    `,
    related: ["fazer-campanha"],
  },

  // =====================================================================
  // PLANOS
  // =====================================================================
  {
    slug: "como-funcionam-planos",
    title: "Como funcionam os planos",
    category: "planos",
    description: "Mensal vs anual, mudar de plano, cancelar",
    body: `
      <h2>Modelo</h2>
      <p>FJN Atende é <strong>pago-pra-usar</strong>: sem trial gratuito. Depois de criar conta,
        você escolhe Pro ou Pro+ pra começar a usar.</p>

      <h2>Cobrança</h2>
      <ul>
        <li>Mensal: cobra todo dia X do mês via cartão (Stripe)</li>
        <li>Anual: cobra 1x por ano com 20% off</li>
        <li>Cartão recusado: bloqueia uso na hora, manda e-mail pra atualizar</li>
      </ul>

      <h2>Mudar de plano</h2>
      <p>Em <a href="/planos">/planos</a>, clica no plano novo. Sistema calcula <strong>prorate</strong>:</p>
      <ul>
        <li>Upgrade no meio do mês: cobra só a diferença proporcional</li>
        <li>Downgrade: crédito vira saldo pro próximo ciclo</li>
      </ul>

      <h2>Cancelar</h2>
      <p>Em <a href="/configuracoes/plano">/configuracoes/plano</a> → <strong>Cancelar assinatura</strong>.
        Você mantém acesso até o fim do período pago. Pode reativar a qualquer momento.</p>
    `,
    related: ["diferenca-pro-pro-plus", "comprar-credito"],
  },
  {
    slug: "comprar-credito",
    title: "Comprar crédito pré-pago",
    category: "planos",
    description: "Quando comprar e como aproveitar os bônus",
    body: `
      <h2>O que é o crédito pré-pago</h2>
      <p>É um saldo em reais que cobre <strong>excedentes do plano</strong>:</p>
      <ul>
        <li>Mensagens IA além da cota mensal (R$ 0,03/msg)</li>
        <li>Mensagens de campanha extra (depende do provider)</li>
        <li>Outras features cobradas por uso</li>
      </ul>

      <h2>Pacotes com bônus</h2>
      <ul>
        <li>R$ 50 → R$ 50</li>
        <li>R$ 100 → R$ 105 (+R$ 5 bônus)</li>
        <li>R$ 200 → R$ 220 (+R$ 20 bônus)</li>
        <li>R$ 500 → R$ 575 (+R$ 75 bônus)</li>
        <li>R$ 1.000 → R$ 1.200 (+R$ 200 bônus)</li>
      </ul>

      <p>Quanto maior a recarga, maior o bônus. Compra em <a href="/creditos/comprar">/creditos/comprar</a>
        via PIX (instantâneo), cartão ou boleto.</p>

      <h2>Alerta de saldo baixo</h2>
      <p>Quando o saldo cai abaixo de R$ 10, você recebe um e-mail avisando pra recarregar
        antes que campanhas pausem.</p>
    `,
    related: ["como-funcionam-planos"],
  },

  // =====================================================================
  // WHITE-LABEL
  // =====================================================================
  {
    slug: "personalizar-marca",
    title: "Personalizar logo e cores (white-label)",
    category: "whitelabel",
    description: "Disponível no plano Pro+",
    body: `
      <h2>O que você pode customizar</h2>
      <ul>
        <li><strong>Logo</strong> — aparece no topo do painel (upload PNG/SVG até 100KB)</li>
        <li><strong>Cores</strong> — primária (fundo) e destaque (botões, links)</li>
        <li><strong>Nome de exibição</strong> — substitui o nome da empresa no painel</li>
        <li><strong>E-mail e telefone de suporte</strong> — aparece no rodapé dos e-mails</li>
      </ul>

      <h2>Como configurar</h2>
      <ol>
        <li>Vai em <a href="/configuracoes/branding">/configuracoes/branding</a></li>
        <li>Faz upload da logo OU cola URL externa</li>
        <li>Define cores no color picker</li>
        <li>Preview ao vivo aparece no topo</li>
        <li>Clica em <strong>Salvar branding</strong></li>
      </ol>

      <h2>White-label completo (Enterprise)</h2>
      <p>Inclui <strong>subdomain personalizado</strong> (ex: atende.minhaempresa.com.br)
        e <strong>esconder marca FJN</strong> dos e-mails.</p>
    `,
    related: ["diferenca-pro-pro-plus"],
  },
];

// Helper pra agrupar artigos por categoria
export function articlesByCategory(): Record<ArticleCategory, Article[]> {
  const grouped: any = {};
  for (const cat of Object.keys(CATEGORIES) as ArticleCategory[]) {
    grouped[cat] = ARTICLES.filter((a) => a.category === cat);
  }
  return grouped;
}
