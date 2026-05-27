import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade — FJN Atende",
  description: "Como tratamos seus dados pessoais. Conformidade LGPD.",
  robots: { index: true, follow: true },
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      subtitle="Como tratamos seus dados pessoais — Conformidade LGPD"
      lastUpdated="27 de maio de 2026"
    >
      <p>
        A <strong>FJN Tecnologia</strong> ("FJN", "nós") leva sua privacidade a sério. Esta
        Política descreve quais dados coletamos, por que coletamos, como usamos e quais direitos
        você tem sobre eles, em conformidade com a <strong>Lei Geral de Proteção de Dados
        Pessoais (LGPD — Lei 13.709/2018)</strong>.
      </p>

      <h2>1. Quem é o controlador dos dados</h2>
      <p>
        <strong>FJN Tecnologia</strong> é a controladora dos dados pessoais tratados na plataforma
        FJN Atende.
      </p>
      <ul>
        <li><strong>CNPJ:</strong> [a preencher]</li>
        <li><strong>Endereço:</strong> Cuiabá-MT, Brasil</li>
        <li><strong>E-mail de privacidade:</strong> <a href="mailto:fjntecnologia2022@gmail.com">fjntecnologia2022@gmail.com</a></li>
        <li><strong>Encarregado (DPO):</strong> Fagner José Neno</li>
      </ul>

      <h2>2. Quais dados coletamos</h2>
      <h3>2.1. Dados de cadastro (Cliente)</h3>
      <ul>
        <li>Nome completo</li>
        <li>E-mail</li>
        <li>Telefone (opcional)</li>
        <li>Razão social / CNPJ (se pessoa jurídica)</li>
        <li>Senha (armazenada com hash bcrypt, nunca em texto plano)</li>
      </ul>

      <h3>2.2. Dados de uso da plataforma</h3>
      <ul>
        <li>Endereço IP, navegador, sistema operacional</li>
        <li>Logs de acesso e ações no painel</li>
        <li>Configurações da conta, prompts customizados, dossiês</li>
        <li>Métricas agregadas de uso</li>
      </ul>

      <h3>2.3. Dados das conversas WhatsApp</h3>
      <p>
        Quando você usa o FJN Atende para atender clientes ou disparar campanhas, tratamos:
      </p>
      <ul>
        <li>Conteúdo das mensagens enviadas e recebidas</li>
        <li>Números de telefone dos destinatários (incluídos em listas pelo Cliente)</li>
        <li>Nomes (push name do WhatsApp ou informados)</li>
        <li>Mídias (imagens, áudios, documentos) recebidas — processadas em memória, não armazenadas além do necessário</li>
        <li>Metadados (data, hora, status de entrega/leitura)</li>
      </ul>

      <h3>2.4. Dados de pagamento</h3>
      <p>
        Pagamentos são processados pela <strong>Stripe</strong>, que coleta os dados de cartão/PIX/boleto.
        A FJN <strong>não armazena</strong> dados de cartão de crédito completos. Recebemos apenas
        confirmação de pagamento e os últimos 4 dígitos para fins de identificação.
      </p>

      <h2>3. Como usamos os dados</h2>
      <p>
        Tratamos dados pessoais para:
      </p>
      <ul>
        <li><strong>Prestação do serviço</strong> — manter sua conta, processar conversas, enviar campanhas</li>
        <li><strong>Cobrança</strong> — emissão de notas, gestão de assinatura, controle de crédito</li>
        <li><strong>Comunicação</strong> — avisos operacionais, atualizações, suporte</li>
        <li><strong>Melhoria do produto</strong> — análise agregada de uso (sempre anonimizada)</li>
        <li><strong>Segurança</strong> — prevenção de fraudes, abusos, ataques</li>
        <li><strong>Cumprimento legal</strong> — atender obrigações fiscais, regulatórias e judiciais</li>
      </ul>

      <h2>4. Base legal (LGPD art. 7º)</h2>
      <p>
        Tratamos dados pessoais com fundamento em:
      </p>
      <ul>
        <li><strong>Execução de contrato</strong> (inciso V) — pra prestar o serviço contratado;</li>
        <li><strong>Cumprimento de obrigação legal</strong> (inciso II) — fiscal, tributária, regulatória;</li>
        <li><strong>Legítimo interesse</strong> (inciso IX) — melhoria de produto, segurança;</li>
        <li><strong>Consentimento</strong> (inciso I) — quando necessário, sempre revogável.</li>
      </ul>

      <h2>5. Compartilhamento de dados</h2>
      <p>
        Compartilhamos dados apenas com fornecedores essenciais à operação:
      </p>
      <ul>
        <li><strong>Anthropic PBC</strong> (EUA) — processamento de IA (Claude). Mensagens trafegam para gerar respostas.</li>
        <li><strong>OpenAI</strong> (EUA, opcional) — transcrição de áudio (Whisper).</li>
        <li><strong>Meta Platforms</strong> — quando usado WhatsApp Cloud API oficial.</li>
        <li><strong>Stripe Inc.</strong> (EUA) — processamento de pagamentos.</li>
        <li><strong>Neon Inc.</strong> (EUA) — banco de dados Postgres em nuvem.</li>
        <li><strong>Vercel Inc.</strong> (EUA) — hospedagem do frontend.</li>
        <li><strong>Hostinger</strong> (Lituânia/EUA) — hospedagem dos servidores backend.</li>
      </ul>
      <p>
        Todos esses fornecedores aderem a padrões internacionais (ISO 27001, SOC 2) ou possuem
        cláusulas contratuais de proteção de dados conformes ao GDPR/LGPD.
      </p>
      <p>
        <strong>Não vendemos seus dados.</strong> Não compartilhamos com anunciantes ou parceiros
        de marketing.
      </p>

      <h2>6. Transferência internacional</h2>
      <p>
        Alguns dados são transferidos para servidores fora do Brasil (principalmente EUA), por
        força dos fornecedores listados acima. A LGPD permite essa transferência por estarmos
        sob bases legais válidas (execução de contrato, garantias contratuais de proteção).
      </p>

      <h2>7. Retenção e exclusão</h2>
      <p>
        Mantemos dados pelo período necessário:
      </p>
      <ul>
        <li><strong>Conta ativa</strong> — enquanto durar o contrato;</li>
        <li><strong>Conta cancelada</strong> — até 90 dias para eventual reativação, depois excluída;</li>
        <li><strong>Dados fiscais</strong> — 5 anos (obrigação legal);</li>
        <li><strong>Logs de segurança</strong> — 12 meses;</li>
        <li><strong>Backups</strong> — purgados em até 30 dias após exclusão lógica.</li>
      </ul>

      <h2>8. Seus direitos (LGPD art. 18)</h2>
      <p>
        Você pode, a qualquer momento, exercer os seguintes direitos:
      </p>
      <ul>
        <li><strong>Confirmação</strong> de que tratamos seus dados;</li>
        <li><strong>Acesso</strong> aos dados que temos sobre você;</li>
        <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados;</li>
        <li><strong>Anonimização ou exclusão</strong> de dados desnecessários ou tratados em desconformidade;</li>
        <li><strong>Portabilidade</strong> dos dados para outro fornecedor;</li>
        <li><strong>Revogação do consentimento</strong>;</li>
        <li><strong>Oposição</strong> a tratamentos baseados em legítimo interesse;</li>
        <li><strong>Informações sobre compartilhamento</strong> e finalidades.</li>
      </ul>
      <p>
        Pra exercer, envie e-mail para{" "}
        <a href="mailto:fjntecnologia2022@gmail.com">fjntecnologia2022@gmail.com</a> com
        assunto <code>[LGPD] Solicitação de direitos</code>. Respondemos em até <strong>15 dias</strong>.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos apenas <strong>cookies essenciais</strong> (autenticação, sessão). Não usamos cookies
        de rastreamento publicitário ou de terceiros.
      </p>
      <p>
        Cookies essenciais não exigem consentimento prévio (LGPD art. 7º, V — execução de contrato).
      </p>

      <h2>10. Crianças e adolescentes</h2>
      <p>
        A FJN Atende é destinada a pessoas <strong>maiores de 18 anos</strong> ou pessoas jurídicas.
        Não coletamos intencionalmente dados de menores. Se identificarmos cadastro de menor,
        a conta será encerrada e dados excluídos imediatamente.
      </p>

      <h2>11. Segurança dos dados</h2>
      <p>
        Aplicamos medidas técnicas e organizacionais para proteger seus dados:
      </p>
      <ul>
        <li>Criptografia em trânsito (HTTPS/TLS 1.2+);</li>
        <li>Criptografia em repouso no banco de dados;</li>
        <li>Hash bcrypt para senhas;</li>
        <li>Autenticação por JWT com expiração;</li>
        <li>Isolamento multi-tenant (Row-Level Security);</li>
        <li>Backup diário com retenção;</li>
        <li>Controle de acesso baseado em perfil (RBAC);</li>
        <li>Logs de auditoria de ações sensíveis;</li>
        <li>Atualizações de segurança periódicas.</li>
      </ul>
      <p>
        Nenhum sistema é 100% seguro. Em caso de incidente que afete dados pessoais com risco
        relevante, notificaremos a <strong>ANPD</strong> e os titulares afetados conforme
        previsto no art. 48 da LGPD.
      </p>

      <h2>12. Responsabilidade do Cliente em relação aos dados de terceiros</h2>
      <p>
        Quando você usa a FJN Atende para enviar mensagens ou armazenar contatos de seus próprios
        clientes/destinatários, <strong>você é o controlador desses dados</strong>, e a FJN atua
        como <strong>operador</strong> (LGPD art. 5º, VII).
      </p>
      <p>
        Como controlador, você deve:
      </p>
      <ul>
        <li>Ter base legal válida para tratar esses dados (consentimento, execução de contrato, legítimo interesse);</li>
        <li>Informar seus titulares sobre o tratamento;</li>
        <li>Atender solicitações de direitos LGPD dos seus titulares;</li>
        <li>Respeitar opt-outs imediatamente.</li>
      </ul>

      <h2>13. Alterações desta Política</h2>
      <p>
        Podemos atualizar esta Política. Alterações relevantes serão comunicadas por e-mail e/ou
        notificação no painel com pelo menos 15 dias de antecedência.
      </p>

      <h2>14. Contato</h2>
      <p>
        <strong>Encarregado de Proteção de Dados (DPO)</strong><br />
        Nome: Fagner José Neno<br />
        E-mail: <a href="mailto:fjntecnologia2022@gmail.com">fjntecnologia2022@gmail.com</a><br />
        WhatsApp: <a href="https://wa.me/5565980900089">+55 (65) 98090-0089</a>
      </p>
      <p>
        Você também pode reclamar diretamente à{" "}
        <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>:{" "}
        <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noopener">www.gov.br/anpd</a>
      </p>
    </LegalPage>
  );
}
