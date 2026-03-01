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
        <p>Bem-vindo ao Katuu! Ao utilizar nosso aplicativo, você concorda com os seguintes termos:</p>
        <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
        <p>Ao acessar ou usar o Katuu, você confirma que leu, entendeu e concorda em estar vinculado a estes Termos de Uso.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Uso do Serviço</h2>
        <p>Você se compromete a utilizar o aplicativo de forma responsável, respeitando outros usuários e as leis aplicáveis.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Conta do Usuário</h2>
        <p>Você é responsável por manter a confidencialidade de sua conta e senha. Notifique-nos imediatamente sobre qualquer uso não autorizado.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Privacidade</h2>
        <p>Sua privacidade é importante para nós. Consulte nossa Política de Privacidade para entender como coletamos e usamos seus dados.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Modificações</h2>
        <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas através do aplicativo.</p>
        <p className="text-xs text-muted-foreground/60 mt-8">Última atualização: Março de 2026</p>
      </div>
    </div>
  );
}
