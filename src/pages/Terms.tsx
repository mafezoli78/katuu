import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10 max-w-2xl mx-auto">
      <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold mb-6">Termos de Uso</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">

        <h2 className="text-lg font-semibold text-foreground">1. Sobre o Katuu</h2>
        <p>O Katuu é uma plataforma social de presença física que conecta pessoas que estão no mesmo local ao mesmo tempo e estão abertas para uma conversa. O aplicativo é operado por:</p>
        <p>
          <strong className="text-foreground">R ROMANETTO - PRIMUS APPS</strong><br />
          CNPJ: 66.663.358/0001-02<br />
          Endereço: [Rod. Mario Marcondes Lobo, 4200, Porto de Cima, Morretes, PR, 83350-000]<br />
          E-mail: contato@katuu.com.br
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. Aceitação dos Termos</h2>
        <p>Ao criar uma conta ou utilizar o Katuu, você concorda com estes Termos de Uso. Se não concordar com qualquer parte, não utilize o aplicativo.</p>

        <h2 className="text-lg font-semibold text-foreground">3. Elegibilidade</h2>
        <p>Para usar o Katuu você deve ter pelo menos 18 anos de idade, ter capacidade legal para aceitar estes termos e não ter sido banido previamente da plataforma.</p>

        <h2 className="text-lg font-semibold text-foreground">4. Conta e Cadastro</h2>
        <p>Você é responsável por manter a confidencialidade da sua conta. As informações fornecidas no cadastro devem ser verdadeiras e atualizadas. É permitida apenas uma conta por pessoa. O login é realizado via Google ou e-mail/senha.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Como o Katuu Funciona</h2>
        <p>O Katuu exige que o usuário esteja fisicamente presente em um local para interagir com outras pessoas naquele espaço. A presença é ativada manualmente e tem duração de até 2 horas, podendo ser renovada. Ao sair do local ou encerrar a presença, as conversas ativas são encerradas e as mensagens apagadas.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Conteúdo do Usuário</h2>
        <p>Você é o único responsável pelo conteúdo que compartilha. Não é permitido conteúdo ofensivo, ilegal, discriminatório, sexual explícito ou que viole direitos de terceiros. O Katuu não reivindica propriedade sobre seu conteúdo, mas você nos concede licença para exibi-lo dentro da plataforma.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Condutas Proibidas</h2>
        <p>É expressamente proibido: assediar, ameaçar ou intimidar outros usuários; criar perfis falsos ou se passar por outra pessoa; usar o aplicativo para fins comerciais sem autorização; tentar acessar sistemas ou dados de outros usuários; usar ferramentas automatizadas (bots); compartilhar dados pessoais de terceiros sem consentimento; e qualquer conduta que viole a legislação brasileira vigente.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Encerramento de Conversas e Dados</h2>
        <p>As conversas no Katuu são efêmeras por design. Quando uma conversa é encerrada — por qualquer das partes ou automaticamente — as mensagens são permanentemente apagadas. Não há recuperação de mensagens após o encerramento.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Bloqueio e Moderação</h2>
        <p>O Katuu disponibiliza ferramentas de silenciar e bloquear outros usuários. Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos, sem aviso prévio em casos graves.</p>

        <h2 className="text-lg font-semibold text-foreground">10. Privacidade</h2>
        <p>O uso dos seus dados é regido pela nossa Política de Privacidade, disponível no aplicativo.</p>

        <h2 className="text-lg font-semibold text-foreground">11. Isenção de Garantias</h2>
        <p>O Katuu é fornecido "como está". Não garantimos disponibilidade ininterrupta, ausência de erros ou que o serviço atenderá a todas as suas expectativas.</p>

        <h2 className="text-lg font-semibold text-foreground">12. Limitação de Responsabilidade</h2>
        <p>Na máxima extensão permitida por lei, o Katuu não se responsabiliza por danos indiretos, incidentais ou consequentes decorrentes do uso ou impossibilidade de uso do aplicativo.</p>

        <h2 className="text-lg font-semibold text-foreground">13. Alterações nos Termos</h2>
        <p>Podemos atualizar estes Termos a qualquer momento. Você será notificado por e-mail ou pelo aplicativo. O uso continuado após a notificação implica aceitação dos novos termos.</p>

        <h2 className="text-lg font-semibold text-foreground">14. Lei Aplicável e Foro</h2>
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de [CIDADE/ESTADO] para dirimir quaisquer controvérsias.</p>

        <h2 className="text-lg font-semibold text-foreground">15. Contato</h2>
        <p>Dúvidas sobre estes Termos: <strong className="text-foreground">suporte@katuu.com.br</strong></p>

        <p className="text-xs text-muted-foreground/60 mt-8">Última atualização: 22/06/2026</p>
      </div>
    </div>
  );
}
