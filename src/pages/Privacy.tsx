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
        <p>O Katuu respeita sua privacidade. Esta política descreve como coletamos, usamos e protegemos suas informações.</p>
        <h2 className="text-lg font-semibold text-foreground">1. Dados Coletados</h2>
        <p>Coletamos informações como nome, e-mail, foto de perfil e dados de localização quando você utiliza o aplicativo.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Uso dos Dados</h2>
        <p>Seus dados são utilizados para fornecer e melhorar nossos serviços, personalizar sua experiência e garantir a segurança da plataforma.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Compartilhamento</h2>
        <p>Não vendemos seus dados pessoais. Compartilhamos informações apenas conforme necessário para operar o serviço ou quando exigido por lei.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Segurança</h2>
        <p>Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Seus Direitos</h2>
        <p>Você pode solicitar acesso, correção ou exclusão de seus dados pessoais a qualquer momento entrando em contato conosco.</p>
        <p className="text-xs text-muted-foreground/60 mt-8">Última atualização: Março de 2026</p>
      </div>
    </div>
  );
}
