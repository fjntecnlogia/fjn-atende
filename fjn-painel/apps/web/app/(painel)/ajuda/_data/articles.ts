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
  | "whitelabel"
  | "avancado"
  | "troubleshooting"
  | "cases";

export const CATEGORIES: Record<ArticleCategory, { label: string; emoji: string; description: string }> = {
  comecar:         { label: "Começar",          emoji: "🚀", description: "Primeiros passos no FJN Atende" },
  whatsapp:        { label: "WhatsApp",         emoji: "📱", description: "Conectar e gerenciar instâncias" },
  ia:              { label: "IA",               emoji: "🤖", description: "Configurar e personalizar a IA" },
  funil:           { label: "Funil",            emoji: "📊", description: "Kanban, times e métricas" },
  campanhas:       { label: "Campanhas",        emoji: "📣", description: "Disparo em massa anti-ban" },
  planos:          { label: "Planos & Créditos", emoji: "💳", description: "Assinatura, créditos e cotas" },
  whitelabel:      { label: "White-label",      emoji: "🎨", description: "Personalizar marca (Pro+)" },
  avancado:        { label: "Avançado",         emoji: "⚡", description: "Testes A/B, automações, integrações" },
  troubleshooting: { label: "Problemas comuns", emoji: "🔧", description: "Resolver erros e travamentos" },
  cases:           { label: "Cases de uso",     emoji: "💡", description: "Como outros negócios usam o FJN" },
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

  // =====================================================================
  // AVANÇADO
  // =====================================================================
  {
    slug: "teste-ab-campanhas",
    title: "Teste A/B em campanhas — qual mensagem converte mais?",
    category: "avancado",
    description: "Compare 2 versões da mesma mensagem com metade da lista",
    body: `
      <h2>Por que testar</h2>
      <p>Pequenas mudanças no texto podem dobrar a taxa de resposta. Em vez de adivinhar,
        teste com dados reais.</p>

      <h2>Como fazer (passo a passo)</h2>
      <ol>
        <li><strong>Cria 2 templates</strong> em <a href="/campanhas/templates">/campanhas/templates</a>:
          <ul>
            <li>"Template_A": versão original</li>
            <li>"Template_B": versão alternativa (muda só 1 elemento — assunto, CTA, ou tom)</li>
          </ul>
        </li>
        <li><strong>Divide sua lista em 2</strong>:
          <ul>
            <li>Exporta lista CSV em <a href="/campanhas/listas">/campanhas/listas</a></li>
            <li>No Excel: divide em 2 arquivos balanceados (50/50)</li>
            <li>Importa como "Lista_A" e "Lista_B"</li>
          </ul>
        </li>
        <li><strong>Cria 2 campanhas</strong>, cada uma com sua lista + template</li>
        <li><strong>Dispara no mesmo horário</strong> pra comparar com mesmas condições</li>
        <li><strong>Após 24h</strong>, compara as métricas em <a href="/campanhas">/campanhas</a>:
          <ul>
            <li>Taxa de entrega (% que chegou)</li>
            <li>Taxa de resposta (% que respondeu)</li>
            <li>Conversões em vendas (cards Ganho no funil)</li>
          </ul>
        </li>
      </ol>

      <h2>O que testar primeiro</h2>
      <ul>
        <li><strong>Saudação</strong>: "Olá!" vs "Oi tudo bem?" vs nome</li>
        <li><strong>CTA</strong>: "Saiba mais" vs "Aproveite" vs pergunta direta</li>
        <li><strong>Urgência</strong>: com vs sem prazo</li>
        <li><strong>Tom</strong>: formal vs descontraído</li>
        <li><strong>Emoji</strong>: zero, pouco, muito</li>
      </ul>

      <h2>Regra de ouro</h2>
      <p><strong>Mude UMA coisa por vez</strong>. Se mudar texto inteiro, você não sabe o que fez diferença.</p>
    `,
    related: ["fazer-campanha", "importar-csv"],
  },
  {
    slug: "automacoes-tags",
    title: "Automações com tags e segmentação",
    category: "avancado",
    description: "Marque contatos com tags pra atendimento personalizado",
    body: `
      <h2>O que são tags</h2>
      <p>Tags são rótulos que você atribui a contatos ou cards de funil pra identificá-los
        rapidamente. Ex: "vip", "regional-sp", "produto-x", "lead-frio".</p>

      <h2>Onde usar</h2>
      <ul>
        <li><strong>No card do funil</strong>: arrasta tags na sidebar pra organizar por categoria</li>
        <li><strong>Em campanhas</strong>: filtra contatos pra disparar só pros "vip"</li>
        <li><strong>Em métricas</strong>: agrupa conversões por tag</li>
      </ul>

      <h2>Casos práticos</h2>

      <h3>Segmentação por estágio</h3>
      <ul>
        <li>"lead-frio" — recém entrou, ainda não respondeu</li>
        <li>"interessado" — pediu mais info</li>
        <li>"quente" — pediu proposta</li>
        <li>"cliente" — já comprou</li>
      </ul>

      <h3>Segmentação por produto</h3>
      <ul>
        <li>"plano-basico", "plano-premium" pra dar atendimento diferenciado</li>
      </ul>

      <h3>Segmentação geográfica</h3>
      <ul>
        <li>"sul", "sudeste" pra disparos regionais</li>
      </ul>

      <h2>Dica</h2>
      <p>Cria uma lista pequena de 5-10 tags principais e <strong>seja consistente</strong>.
        Se cada atendente cria tags próprias, vira bagunça.</p>
    `,
    related: ["o-que-e-funil", "fazer-campanha"],
  },
  {
    slug: "integracao-api",
    title: "Integração via API (Pro+)",
    category: "avancado",
    description: "Conecte o FJN Atende com seu sistema próprio",
    body: `
      <h2>Pra quem é</h2>
      <p>Empresas que querem:</p>
      <ul>
        <li>Sincronizar leads com CRM próprio (RD Station, HubSpot, etc)</li>
        <li>Receber notificação automática quando lead novo entra</li>
        <li>Enviar mensagens via integração com sistema legado</li>
        <li>Construir dashboards customizados com dados do FJN</li>
      </ul>

      <h2>Como funciona</h2>
      <ol>
        <li>Você gera uma <strong>API Key</strong> em <em>Config IA → Integrações → Criar API Key</em></li>
        <li>Usa essa key no header <code>Authorization: Bearer YOUR_KEY</code></li>
        <li>Chama endpoints REST conforme a documentação técnica</li>
      </ol>

      <h2>Endpoints principais</h2>
      <ul>
        <li><code>GET /api/v1/conversations</code> — lista conversas</li>
        <li><code>POST /api/v1/conversations/:id/messages</code> — manda mensagem</li>
        <li><code>GET /api/v1/leads</code> — lista leads</li>
        <li><code>GET /api/v1/cards</code> — lista cards do funil</li>
        <li><code>POST /api/v1/cards/:id/move</code> — move card</li>
      </ul>

      <h2>Webhooks</h2>
      <p>Cadastra uma URL sua pra receber notificações automáticas:</p>
      <ul>
        <li><code>conversation.created</code> — nova conversa</li>
        <li><code>card.moved</code> — card mudou de etapa</li>
        <li><code>lead.captured</code> — IA capturou dados de lead</li>
      </ul>

      <p>📖 <strong>Documentação técnica completa:</strong> em breve em <code>/api/docs</code></p>
    `,
    related: ["diferenca-pro-pro-plus", "automacoes-tags"],
  },
  {
    slug: "atalhos-produtividade",
    title: "10 atalhos pra ganhar tempo todo dia",
    category: "avancado",
    description: "Truques de teclado e dicas de fluxo pra atendentes",
    body: `
      <h2>Atalhos de teclado (em conversas)</h2>
      <ul>
        <li><strong>Ctrl + Enter</strong> — envia mensagem (em vez de clicar)</li>
        <li><strong>Esc</strong> — fecha modais abertos</li>
        <li><strong>↑ / ↓</strong> — navega entre conversas na lista lateral</li>
      </ul>

      <h2>Truques de fluxo</h2>
      <ol>
        <li><strong>Filtra "não lidas"</strong> em /conversas pra priorizar quem está esperando</li>
        <li><strong>Pin conversas importantes</strong> arrastando pro topo</li>
        <li><strong>Use a sidebar do card</strong> pra mudar etapa sem sair da conversa</li>
        <li><strong>Notas internas</strong> em cada card pra equipe ver contexto sem perguntar</li>
        <li><strong>Templates de resposta rápida</strong> em /campanhas/templates (funciona pra atendimento individual também)</li>
      </ol>

      <h2>Configurações que economizam tempo</h2>
      <ul>
        <li><strong>Notificações desktop</strong> ativadas (Chrome pergunta na primeira vez)</li>
        <li><strong>Round-robin</strong> nos times pra não brigar por conversa</li>
        <li><strong>Auto-pause bot</strong> ativo: IA não interrompe se atendente já está respondendo</li>
      </ul>

      <h2>Hábitos dos top users</h2>
      <ul>
        <li>Verifica funil 5 min toda manhã (cards parados > 24h)</li>
        <li>Adiciona resposta nova em Config IA toda vez que vê pergunta repetida</li>
        <li>Roda 1 campanha por semana mesmo que pequena (50 contatos)</li>
        <li>Faz teste A/B pelo menos 1x por mês</li>
      </ul>
    `,
    related: ["teste-ab-campanhas", "configurar-persona-ia"],
  },
  {
    slug: "metricas-avancadas",
    title: "Métricas avançadas e forecast",
    category: "avancado",
    description: "Como ler números do funil pra tomar decisões",
    body: `
      <h2>Métricas que importam</h2>

      <h3>1. Taxa de conversão por etapa</h3>
      <p>% de cards que avançam de uma etapa pra próxima. Mostra onde você perde clientes.</p>
      <ul>
        <li>Novo → Qualificando: bom se > 70%</li>
        <li>Qualificando → Proposta: bom se > 40%</li>
        <li>Proposta → Ganho: bom se > 20%</li>
      </ul>
      <p>Se está abaixo, tem gargalo. Foca em melhorar essa etapa.</p>

      <h3>2. Tempo médio em cada etapa</h3>
      <p>Quanto tempo o card fica parado. Se passa de 7 dias em "Qualificando", o lead esfriou.</p>

      <h3>3. Forecast (receita esperada)</h3>
      <p>Soma de <em>(valor do card × probabilidade da etapa)</em>. Te dá previsão de quanto vai entrar.</p>
      <p>Exemplo:</p>
      <ul>
        <li>5 cards em "Proposta" (50% prob) com R$ 1000 cada = R$ 2.500 esperados</li>
        <li>3 cards em "Negociação" (75% prob) com R$ 1000 cada = R$ 2.250 esperados</li>
        <li><strong>Total forecast = R$ 4.750</strong></li>
      </ul>

      <h3>4. Performance por atendente</h3>
      <ul>
        <li>Cards abertos (quanto cada um aguenta?)</li>
        <li>Cards ganhos no mês</li>
        <li>Valor total fechado</li>
        <li>Tempo médio até fechar (mais rápido = melhor)</li>
      </ul>

      <h2>Onde ver</h2>
      <p>Em <a href="/funis">/funis/[id]</a> tem botão "Métricas" que abre dashboard completo.</p>
    `,
    related: ["o-que-e-funil", "atalhos-produtividade"],
  },

  // =====================================================================
  // TROUBLESHOOTING
  // =====================================================================
  {
    slug: "whatsapp-nao-recebe",
    title: "WhatsApp conectado mas não recebe mensagens",
    category: "troubleshooting",
    description: "Checklist pra investigar quando para de funcionar",
    body: `
      <h2>1. Verifica o status da instância</h2>
      <p>Em <a href="/whatsapp">/whatsapp</a>, o badge deve estar <strong>verde "Conectado"</strong>.
        Se está amarelo (Conectando) ou vermelho (Desconectado), <a href="/ajuda/reconectar-whatsapp">reconecta</a>.</p>

      <h2>2. Manda mensagem de teste</h2>
      <p>De outro celular, manda "oi" pro número conectado. Aguarda ~10s.</p>
      <ul>
        <li>Se aparecer em /conversas → tudo OK</li>
        <li>Se não aparecer → problema de conexão</li>
      </ul>

      <h2>3. Verifica o WhatsApp no celular</h2>
      <ul>
        <li>Abre o WhatsApp Business no celular</li>
        <li>Menu → Dispositivos conectados</li>
        <li>Deve ter "FJN Atende" listado como ativo</li>
        <li>Se não aparece ou está em vermelho → escaneia QR de novo</li>
      </ul>

      <h2>4. Reinicia a instância</h2>
      <p>Em /whatsapp, clica no menu da instância (⋯) e escolhe <strong>Reiniciar</strong>.
        Aguarda ~30s.</p>

      <h2>5. Ainda não funciona?</h2>
      <p>Chama no WhatsApp <a href="https://wa.me/5565980900089">(65) 98090-0089</a> com:</p>
      <ul>
        <li>Print do status da instância</li>
        <li>Hora da última mensagem recebida</li>
      </ul>
    `,
    related: ["como-conectar-whatsapp", "reconectar-whatsapp"],
  },
  {
    slug: "ia-respondendo-errado",
    title: "IA está respondendo errado ou genericamente",
    category: "troubleshooting",
    description: "Como corrigir respostas da IA",
    body: `
      <h2>Causa mais comum: persona genérica</h2>
      <p>A IA Claude responde com base no que você configurou em /config.
        Se está genérica, é porque o prompt está vago.</p>

      <h2>Checklist pra ajustar</h2>
      <ol>
        <li><strong>Persona detalhada</strong>: não basta dizer "atendente educada". Diga "Joana, mulher 30 anos, mineira, gosta de usar 'meu bem'..."</li>
        <li><strong>Produtos com preços</strong>: lista completa com valores. IA não pode inventar.</li>
        <li><strong>Regras explícitas</strong>: "NUNCA prometer prazo de entrega menor que 5 dias úteis"</li>
        <li><strong>Exemplos de boas respostas</strong>: na seção "Exemplos", cola 3-5 trocas reais que você gostou</li>
        <li><strong>Limites</strong>: "Se perguntar sobre [tópico X], dizer que vai transferir pra humano"</li>
      </ol>

      <h2>Itera: ajusta e testa</h2>
      <ol>
        <li>Manda mensagem pro número de outro celular</li>
        <li>Vê resposta da IA</li>
        <li>Se ruim, ajusta prompt em /config</li>
        <li>Limpa conversa (Menu da conversa → Resetar contexto) e testa de novo</li>
      </ol>

      <h2>Se confundir nomes ou trocar produtos</h2>
      <p>Adiciona regra explícita: "O produto X custa R$ Y. NUNCA confundir com produto Z."</p>

      <h2>Se inventar coisas</h2>
      <p>Adiciona: "Se não souber a resposta exata, dizer: 'Vou verificar e te respondo em alguns minutos' e marca handoff."</p>
    `,
    related: ["configurar-persona-ia", "quando-ia-encaminha-humano"],
  },
  {
    slug: "campanha-pausou-sozinha",
    title: "Campanha pausou sozinha — por quê?",
    category: "troubleshooting",
    description: "Auto-pause é proteção, não bug",
    body: `
      <h2>O FJN Atende pausa campanhas automaticamente</h2>
      <p>Isso é <strong>proteção</strong> pra evitar ban no seu número de WhatsApp. Acontece quando:</p>
      <ul>
        <li><strong>Taxa de falha > 20%</strong> (muitas mensagens não foram entregues)</li>
        <li><strong>Saldo de crédito acabou</strong> e o plano excedeu cota</li>
        <li><strong>WhatsApp desconectou</strong></li>
      </ul>

      <h2>Como diagnosticar</h2>
      <ol>
        <li>Abre a campanha em <a href="/campanhas">/campanhas</a></li>
        <li>Vai na aba "Destinatários"</li>
        <li>Filtra "Falhados" — vê o motivo</li>
      </ol>

      <h2>Motivos comuns de falha</h2>
      <ul>
        <li><strong>"Número não tem WhatsApp"</strong> — limpa a lista e reimporta só números válidos</li>
        <li><strong>"Bloqueado pelo destinatário"</strong> — opt-out automático, OK</li>
        <li><strong>"Rate limit excedido"</strong> — diminui rate_per_min pra 5 ou 8</li>
        <li><strong>"Sem saldo"</strong> — <a href="/creditos/comprar">recarrega crédito</a></li>
      </ul>

      <h2>Retomar campanha</h2>
      <p>Depois de resolver: na tela da campanha, clica em <strong>Retomar</strong>.
        Vai pegar de onde parou.</p>
    `,
    related: ["fazer-campanha", "comprar-credito"],
  },

  // =====================================================================
  // CASES DE USO
  // =====================================================================
  {
    slug: "case-loja-roupas",
    title: "Case — Loja de roupas online (e-commerce)",
    category: "cases",
    description: "Como uma loja triplicou vendas com IA atendendo 24/7",
    body: `
      <h2>Cenário</h2>
      <p>Loja de roupas femininas no Instagram, 2 atendentes humanos. Recebia ~150 mensagens/dia
        e perdia muitas vendas por não responder à noite ou nos fins de semana.</p>

      <h2>Setup do FJN Atende</h2>
      <ul>
        <li><strong>Persona</strong>: "Lara, consultora de moda, jovem, descontraída, usa 'mana'"</li>
        <li><strong>Produtos</strong>: catálogo completo com fotos (URLs) e preços</li>
        <li><strong>Regras</strong>:
          <ul>
            <li>Se cliente perguntar tamanho, mandar tabela de medidas</li>
            <li>Se cliente em SP, mencionar entrega no mesmo dia</li>
            <li>Acima de R$ 200, oferecer parcelamento sem juros</li>
          </ul>
        </li>
        <li><strong>Funil</strong>: 5 etapas (Curiosa → Interessada → Carrinho → Comprou / Não comprou)</li>
      </ul>

      <h2>Resultados após 60 dias</h2>
      <ul>
        <li>📈 Atendimento 24/7 (incluindo madrugada e domingo)</li>
        <li>📈 Tempo de resposta caiu de 3h pra <strong>10 segundos</strong></li>
        <li>📈 Conversão (msg → venda) subiu de 8% pra <strong>22%</strong></li>
        <li>📈 Vendas mensais subiram <strong>3x</strong></li>
        <li>📈 Equipe ficou pra fechar só os casos complexos (50% menos esforço)</li>
      </ul>

      <h2>Aprendizado-chave</h2>
      <p>A IA respondeu 80% das perguntas comuns (tamanho, cor, prazo, parcelamento).
        Humanos focaram em personalização: dúvidas sobre combinações de looks, trocas, dúvidas técnicas.</p>
    `,
    related: ["configurar-persona-ia", "o-que-e-funil"],
  },
  {
    slug: "case-clinica",
    title: "Case — Clínica de estética (agendamentos)",
    category: "cases",
    description: "Agendamento 100% automatizado com confirmação",
    body: `
      <h2>Cenário</h2>
      <p>Clínica com 4 profissionais e 200+ agendamentos/mês. Secretária gastava 4h/dia
        só confirmando e remarcando horários.</p>

      <h2>Setup</h2>
      <ul>
        <li><strong>IA</strong> integrada com agenda externa (Google Calendar via Zapier)</li>
        <li><strong>Funil</strong>: Agendou → Confirmado → Compareceu / Faltou</li>
        <li><strong>Automações</strong>:
          <ul>
            <li>24h antes: campanha "Confirmar amanhã?" com respostas SIM/NÃO/REMARCAR</li>
            <li>2h antes: lembrete final</li>
            <li>1h depois: pesquisa de satisfação</li>
          </ul>
        </li>
      </ul>

      <h2>Resultados</h2>
      <ul>
        <li>📈 No-show caiu de 25% pra <strong>8%</strong> (lembretes funcionam!)</li>
        <li>📈 Secretária ganhou 3h/dia pra atender melhor quem chega</li>
        <li>📈 Mais agendamentos cabem na agenda (taxa de ocupação +40%)</li>
      </ul>

      <h2>Aprendizado</h2>
      <p>Cliente que confirma via WhatsApp <strong>respeita mais o horário</strong> do que cliente
        que só agendou e não recebeu lembrete.</p>
    `,
    related: ["fazer-campanha", "o-que-e-funil"],
  },
  {
    slug: "case-imobiliaria",
    title: "Case — Imobiliária (qualificação de leads)",
    category: "cases",
    description: "Como qualificar leads antes de mandar pra corretor",
    body: `
      <h2>Cenário</h2>
      <p>Imobiliária com 12 corretores. Recebia 300+ leads/semana via redes sociais,
        mas corretores se queixavam: "muitos leads ruins, perco tempo".</p>

      <h2>Setup</h2>
      <ul>
        <li><strong>IA pré-qualifica</strong>: pergunta orçamento, região, tipo de imóvel, prazo</li>
        <li><strong>Score automático</strong>: tag "quente", "morno" ou "frio" baseado nas respostas</li>
        <li><strong>Handoff só dos quentes</strong>: corretor recebe só leads pré-qualificados</li>
        <li><strong>Funil</strong>: Captado → Qualificado → Visita agendada → Proposta → Fechou</li>
        <li><strong>Time round-robin</strong>: leads quentes distribuídos entre 12 corretores</li>
      </ul>

      <h2>Resultados</h2>
      <ul>
        <li>📈 70% dos leads ruins filtrados antes de chegar nos corretores</li>
        <li>📈 Corretores 3x mais produtivos (focam em quem vai fechar)</li>
        <li>📈 Tempo médio até primeira visita caiu de 5 dias pra <strong>1 dia</strong></li>
        <li>📈 Comissões aumentaram 60% no trimestre</li>
      </ul>

      <h2>Aprendizado</h2>
      <p>IA NÃO substitui corretor — <strong>libera corretor pra fazer o que humano faz melhor</strong>:
        construir relacionamento e fechar venda complexa.</p>
    `,
    related: ["automacoes-tags", "times-atendimento"],
  },
  {
    slug: "case-saas",
    title: "Case — SaaS B2B (suporte técnico)",
    category: "cases",
    description: "FAQ automatizado libera time de tickets repetitivos",
    body: `
      <h2>Cenário</h2>
      <p>SaaS B2B com 5.000 clientes pagantes. Time de suporte de 3 pessoas afogado
        com perguntas básicas ("como troco a senha?", "onde vejo a fatura?").</p>

      <h2>Setup</h2>
      <ul>
        <li><strong>Base de conhecimento</strong> embutida na persona IA (lista de 100+ FAQs)</li>
        <li><strong>Tags automáticas</strong>: "billing", "técnico", "feature-request", "bug"</li>
        <li><strong>Funil por categoria</strong>: 3 pipelines (Suporte L1, Bugs, Feature requests)</li>
        <li><strong>Handoff inteligente</strong>: se IA não resolve em 3 trocas, transfere pra humano com contexto</li>
      </ul>

      <h2>Resultados</h2>
      <ul>
        <li>📈 65% dos tickets resolvidos sem humano (eram FAQs)</li>
        <li>📈 Tempo médio de resposta: <strong>15 segundos</strong> (era 4h)</li>
        <li>📈 Time de suporte focou em bugs reais e features (que dependem de humano)</li>
        <li>📈 NPS subiu de 32 pra 68 (clientes amam respostas instantâneas)</li>
      </ul>

      <h2>Aprendizado</h2>
      <p>Quanto mais perguntas você ensina pra IA, mais tempo o time humano ganha.
        Investiu 1 semana montando FAQ inicial e ganha 30h/semana desde então.</p>
    `,
    related: ["configurar-persona-ia", "criar-pipeline"],
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
