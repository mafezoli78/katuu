import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10 max-w-2xl mx-auto">
      <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold mb-6">Política de Privacidade</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">

        <h2 className="text-lg font-semibold text-foreground">1. Controlador dos Dados</h2>
        <p>Esta Política descreve como o Katuu coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
        <p>
          <strong className="text-foreground">R ROMANETTO - PRIMUS APPS</strong><br />
          CNPJ: 66.663.358/0001-02<br />
          Endereço: [Rod. Mario Marcondes Lobo, 4200, Porto de Cima, Morretes, PR, 83350-000]<br />
          E-mail do DPO: privacidade@katuu.com.br
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. Dados que Coletamos</h2>
        <p><strong className="text-foreground">Fornecidos por você:</strong> nome, data de nascimento e gênero; foto de perfil; bio e interesses; selfie de check-in; mensagens trocadas nas conversas ativas; intenção de presença.</p>
        <p><strong className="text-foreground">Coletados automaticamente:</strong> localização geográfica (GPS), apenas quando o app está em uso e com sua permissão; endereço IP e dados de dispositivo; logs de uso e atividade.</p>
        <p><strong className="text-foreground">De terceiros:</strong> informações básicas do Google quando você opta pelo login via Google (nome, e-mail e foto).</p>

        <h2 className="text-lg font-semibold text-foreground">3. Como Usamos seus Dados</h2>
        <p>Seus dados são usados para: criar e gerenciar sua conta (execução de contrato); mostrar sua presença a pessoas no mesmo local (execução de contrato); verificar proximidade geográfica via GPS (execução de contrato); enviar notificações do app (execução de contrato); prevenir fraudes e abusos (legítimo interesse); melhorar o produto com dados agregados e anônimos (legítimo interesse); cumprir obrigações legais.</p>

        <h2 className="text-lg font-semibold text-foreground">4. Dados de Localização</h2>
        <p>O Katuu requer acesso à sua localização para funcionar. Ela é usada exclusivamente para encontrar locais próximos, verificar se você permanece na área do local escolhido e mostrar sua presença a outros usuários do mesmo local. A localização não é armazenada continuamente nem compartilhada com terceiros para fins publicitários.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Selfies de Check-in</h2>
        <p>A selfie tirada no momento do check-in é armazenada de forma segura e visível apenas para usuários que estão no mesmo local que você, durante o período de presença ativa. O acesso é protegido por autenticação.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Mensagens e Conversas</h2>
        <p>As mensagens no Katuu são efêmeras por design. Ao encerrar uma conversa — por qualquer das partes ou automaticamente — as mensagens são permanentemente apagadas do nosso banco de dados. Não mantemos histórico de conversas.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Compartilhamento de Dados</h2>
        <p>Não vendemos seus dados. Compartilhamos informações apenas com provedores de infraestrutura (Supabase e Google Cloud, sujeitos às suas próprias políticas) e autoridades quando exigido por lei ou ordem judicial.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Retenção de Dados</h2>
        <p>Mensagens: apagadas imediatamente ao encerrar a conversa. Selfie de check-in: apagada ao encerrar a presença. Dados de perfil: mantidos enquanto a conta estiver ativa. Logs de segurança: até 6 meses. Dados de conta encerrada: até 30 dias após encerramento.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Seus Direitos (LGPD)</h2>
        <p>Você tem direito a confirmar a existência de tratamento dos seus dados, acessá-los, corrigir dados incompletos, solicitar anonimização ou eliminação, portabilidade, revogar consentimentos e eliminar sua conta com todos os dados associados. Para exercer esses direitos: <strong className="text-foreground">privacidade@katuu.com.br</strong></p>

        <h2 className="text-lg font-semibold text-foreground">10. Segurança</h2>
        <p>Adotamos comunicação criptografada (HTTPS/TLS), armazenamento seguro com controle de acesso por autenticação, políticas de acesso mínimo (Row Level Security) e proteção contra senhas vazadas.</p>

        <h2 className="text-lg font-semibold text-foreground">11. Cookies</h2>
        <p>O Katuu utiliza armazenamento local no dispositivo apenas para manter sua sessão ativa. Não utilizamos cookies de rastreamento ou publicidade.</p>

        <h2 className="text-lg font-semibold text-foreground">12. Menores de Idade</h2>
        <p>O Katuu não é destinado a menores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos uma conta de menor de idade, ela será encerrada.</p>

        <h2 className="text-lg font-semibold text-foreground">13. Alterações nesta Política</h2>
        <p>Podemos atualizar esta Política periodicamente. Alterações relevantes serão comunicadas pelo aplicativo ou por e-mail com antecedência mínima de 15 dias.</p>

        <h2 className="text-lg font-semibold text-foreground">14. Contato e DPO</h2>
        <p>
          Encarregado de Proteção de Dados: <strong className="text-foreground">privacidade@katuu.com.br</strong><br />
          Suporte geral: <strong className="text-foreground">suporte@katuu.com.br</strong>
        </p>

        <p className="text-xs text-muted-foreground/60 mt-8">Última atualização: 22/06/2026</p>
      </div>
    </div>
  );
}
