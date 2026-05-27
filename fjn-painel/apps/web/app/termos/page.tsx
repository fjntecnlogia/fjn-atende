import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso — FJN Atende",
  description: "Termos e condições de uso da plataforma FJN Atende.",
  robots: { index: true, follow: true },
};

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      subtitle="Condições gerais para uso da plataforma FJN Atende"
      lastUpdated="27 de maio de 2026"
    >
      <p>
        Bem-vindo(a) à <strong>FJN Atende</strong>. Estes Termos de Uso ("Termos") regulam o
        acesso e uso da plataforma FJN Atende, oferecida por <strong>FJN Tecnologia</strong>
        ("FJN", "nós"). Ao criar uma conta ou usar nossos serviços, você ("Cliente", "Usuário")
        concorda integralmente com estes Termos. Se não concordar, não use a plataforma.
      </p>

      <h2>1. Sobre o serviço</h2>
      <p>
        A FJN Atende é uma plataforma SaaS (Software as a Service) que oferece, entre outras
        funcionalidades:
      </p>
      <ul>
        <li>Atendimento automatizado de mensagens WhatsApp por inteligência artificial</li>
        <li>Painel de gestão de conversas, leads e atendentes</li>
        <li>Disparo de mensagens em massa via WhatsApp Business (Campanhas)</li>
        <li>Gestão de listas de contatos e templates</li>
        <li>Relatórios, dashboards e analytics</li>
      </ul>
      <p>
        A FJN <strong>não é</strong> filiada, patrocinada ou endossada pela Meta Platforms, Inc.
        (proprietária do WhatsApp), Anthropic PBC ou outras marcas mencionadas. Somos um software
        independente que utiliza APIs públicas ou autorizadas dessas plataformas.
      </p>

      <h2>2. Cadastro e conta</h2>
      <h3>2.1. Elegibilidade</h3>
      <p>
        Para criar conta na FJN Atende, você declara que:
      </p>
      <ul>
        <li>É maior de 18 anos OU representa pessoa jurídica regularmente constituída no Brasil ou no exterior;</li>
        <li>Tem capacidade legal para celebrar contratos;</li>
        <li>As informações fornecidas no cadastro são verdadeiras, atuais e completas;</li>
        <li>Manterá os dados atualizados.</li>
      </ul>

      <h3>2.2. Segurança da conta</h3>
      <p>
        Você é o único responsável por:
      </p>
      <ul>
        <li>Manter a confidencialidade da senha e demais credenciais de acesso;</li>
        <li>Toda atividade que ocorrer em sua conta;</li>
        <li>Notificar a FJN imediatamente em caso de acesso não autorizado.</li>
      </ul>

      <h2>3. Planos, preços e pagamento</h2>
      <h3>3.1. Planos</h3>
      <p>
        Oferecemos diferentes planos (Trial, Starter, Pro, Enterprise) com features e limites
        distintos, disponíveis em <a href="/#pricing">nosso site</a>. O período de teste gratuito
        de 14 dias não exige cartão de crédito.
      </p>

      <h3>3.2. Cobrança</h3>
      <p>
        Os planos pagos são cobrados mensalmente, em moeda brasileira (BRL), via cartão de crédito,
        PIX ou boleto através de processadores de pagamento autorizados (Stripe).
        Disparos em massa de mensagens são cobrados separadamente, em modelo <em>pay-per-use</em>,
        debitados de saldo pré-pago.
      </p>

      <h3>3.3. Cancelamento e reembolso</h3>
      <p>
        Você pode cancelar a assinatura a qualquer momento pelo painel. Não há fidelidade. O acesso
        permanece ativo até o fim do período já pago. Não oferecemos reembolso proporcional de
        períodos parciais, exceto quando exigido por lei (CDC).
      </p>

      <h3>3.4. Reajuste</h3>
      <p>
        Preços podem ser reajustados anualmente pelo IPCA ou índice equivalente. Mudanças serão
        comunicadas com pelo menos 30 dias de antecedência.
      </p>

      <h2>4. Uso permitido</h2>
      <p>
        Você concorda em usar a FJN Atende apenas para finalidades legítimas, em conformidade
        com a legislação brasileira, incluindo:
      </p>
      <ul>
        <li><strong>Lei Geral de Proteção de Dados Pessoais (LGPD)</strong> — Lei 13.709/2018;</li>
        <li><strong>Código de Defesa do Consumidor (CDC)</strong> — Lei 8.078/1990;</li>
        <li><strong>Marco Civil da Internet</strong> — Lei 12.965/2014;</li>
        <li>Termos de Serviço do <strong>WhatsApp</strong>;</li>
        <li>Demais regulamentações setoriais aplicáveis.</li>
      </ul>

      <h2>5. Uso PROIBIDO</h2>
      <p>
        Você <strong>NÃO PODE</strong> usar a FJN Atende para:
      </p>
      <ul>
        <li>Enviar SPAM, mensagens não solicitadas ou pra contatos que NÃO autorizaram receber;</li>
        <li>Fraude, golpes, phishing, esquemas piramidais, falsidade ideológica;</li>
        <li>Promover discurso de ódio, violência, conteúdo ilegal, pornografia infantil;</li>
        <li>Disseminar desinformação eleitoral ou que cause dano à saúde pública;</li>
        <li>Violar direitos autorais, marcas registradas ou propriedade intelectual de terceiros;</li>
        <li>Engenharia reversa, descompilação ou tentativa de acesso não autorizado ao sistema;</li>
        <li>Sobrecarga intencional dos servidores, ataques DDoS ou similares;</li>
        <li>Revender ou sublicenciar o serviço sem autorização escrita da FJN;</li>
        <li>Personificar outra pessoa, empresa ou marca sem autorização.</li>
      </ul>
      <p>
        O descumprimento <strong>resulta em suspensão imediata da conta</strong>, sem aviso prévio
        e sem direito a reembolso. A FJN poderá ainda comunicar autoridades competentes.
      </p>

      <h2>6. Disparo em massa — obrigações do Cliente</h2>
      <p>
        Ao usar o módulo de Campanhas, você concorda que:
      </p>
      <ul>
        <li>
          <strong>Tem consentimento prévio dos destinatários</strong> ou base legal válida (LGPD
          art. 7º) para enviar as mensagens;
        </li>
        <li>
          Não enviará mensagens a contatos que tenham solicitado opt-out, por qualquer canal;
        </li>
        <li>
          Respeitará o opt-out automático da plataforma (palavras-chave PARAR, SAIR etc);
        </li>
        <li>
          Não usará a plataforma para disparos em volume superior aos limites do plano contratado;
        </li>
        <li>
          Assume <strong>responsabilidade exclusiva</strong> por reclamações de destinatários,
          banimentos do WhatsApp, multas administrativas ou ações judiciais decorrentes de uso
          inadequado.
        </li>
      </ul>

      <h2>7. WhatsApp — risco de banimento</h2>
      <p>
        O WhatsApp pode, a qualquer momento, banir números utilizados na plataforma. As causas
        mais comuns são: alta taxa de denúncias, volume excessivo, mensagens idênticas em massa,
        envio para contatos não autorizados.
      </p>
      <p>
        A FJN implementa medidas técnicas para reduzir esse risco (rate-limiting, jitter aleatório,
        opt-out automático), mas <strong>não pode garantir que números não serão banidos</strong>.
        O Cliente assume esse risco e isenta a FJN de qualquer responsabilidade por banimento.
      </p>

      <h2>8. Propriedade intelectual</h2>
      <p>
        Todo o software, código-fonte, design, marca, logos e materiais da FJN Atende são
        propriedade exclusiva da <strong>FJN Tecnologia</strong>. O Cliente recebe apenas uma
        <em>licença limitada, revogável, não exclusiva e intransferível</em> de uso conforme
        seu plano.
      </p>
      <p>
        Os dados que você insere na plataforma (contatos, mensagens, configurações) continuam
        sendo seus. Concedemos apenas autorização para processá-los conforme necessário para
        prestar o serviço (vide Política de Privacidade).
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        A FJN Atende é fornecida <strong>"como está"</strong>. Nos esforçamos para máximo uptime
        e qualidade, mas não garantimos disponibilidade 100% ininterrupta. Nossa responsabilidade
        total fica limitada ao valor pago pelo Cliente nos últimos <strong>3 meses</strong>.
      </p>
      <p>
        A FJN <strong>NÃO se responsabiliza</strong> por:
      </p>
      <ul>
        <li>Perdas indiretas, lucros cessantes, danos morais;</li>
        <li>Banimento de números de WhatsApp;</li>
        <li>Decisões de IA de terceiros (Anthropic Claude) inadequadas em casos específicos;</li>
        <li>Interrupções de serviços de terceiros (Vercel, Hostinger, Neon, Stripe, Anthropic, Meta);</li>
        <li>Uso indevido da plataforma pelo Cliente.</li>
      </ul>

      <h2>10. Suspensão e rescisão</h2>
      <p>
        A FJN pode suspender ou encerrar contas que:
      </p>
      <ul>
        <li>Violarem estes Termos;</li>
        <li>Tiverem inadimplência superior a 7 dias;</li>
        <li>Receberem denúncias graves de SPAM, fraude ou conteúdo ilegal;</li>
        <li>Tentarem fraudar a plataforma.</li>
      </ul>
      <p>
        Você pode encerrar a conta a qualquer momento. Dados serão mantidos por até{" "}
        <strong>90 dias</strong> após o encerramento, depois excluídos definitivamente
        (salvo obrigação legal de retenção).
      </p>

      <h2>11. Alterações dos Termos</h2>
      <p>
        Podemos atualizar estes Termos. Alterações relevantes serão comunicadas com pelo menos
        15 dias de antecedência por e-mail e/ou notificação no painel. O uso continuado após
        a data de vigência implica aceitação.
      </p>

      <h2>12. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de{" "}
        <strong>Cuiabá-MT</strong>, com renúncia a qualquer outro, por mais privilegiado que seja,
        para dirimir quaisquer controvérsias.
      </p>

      <h2>13. Contato</h2>
      <p>
        <strong>FJN Tecnologia</strong><br />
        E-mail: <a href="mailto:fjntecnologia2022@gmail.com">fjntecnologia2022@gmail.com</a><br />
        WhatsApp: <a href="https://wa.me/5565980900089">+55 (65) 98090-0089</a><br />
        Cuiabá-MT, Brasil
      </p>
    </LegalPage>
  );
}
