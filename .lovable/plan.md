## Diagnóstico Estrutural — Tela de Login Legada Intermitente

Causa Raiz Identificada

O problema é uma race condition clássica no bootstrap de autenticação. Veja o fluxo de execução:

Plain text

Copiar código

1. App monta → AuthProvider monta → loading = true, user = null

2. onAuthStateChange registrado (assíncrono, aguarda callback)

3. getSession() disparado (assíncrono, aguarda resposta da rede)

4. ENQUANTO ISSO, a rota atual renderiza normalmente

O problema central: A decisão de qual rota renderizar ocorre antes de loading estabilizar, permitindo redirecionamentos indevidos durante o bootstrap.

Pontos Exatos de Falha

1. Auth.tsx — Redireciona baseado apenas em user, sem considerar loading.

2. Home.tsx — Redireciona baseado apenas em user, sem considerar loading.

3. Splash.tsx — Atua apenas na rota /, não protege acessos diretos a /home ou /auth.

4. AuthContext.tsx — O duplo setLoading(false) não é a causa raiz e não precisa ser alterado neste momento.

Cenário de Reprodução

Plain text

Copiar código

1. Usuário logado abre app em /home

2. AuthProvider inicia: loading=true, user=null

3. Home.tsx executa useEffect → !user é true → navigate('/auth')

4. Auth.tsx renderiza completamente

5. getSession resolve → user preenchido → Auth redireciona para /home

Em conexões lentas, a etapa 4 pode permitir interação indevida.

Proposta de Correção Estrutural

Abordagem (correção centralizada)

Bloquear a renderização de qualquer rota enquanto loading === true, no nível do componente que controla as rotas principais (ex: App.tsx).

A proteção deve ser única e centralizada.

Alteração Única — App.tsx (ou componente que contém <Routes>)

Adicionar no topo do componente que define as rotas:

TypeScript

Copiar código

const { user, loading } = useAuth();

if (loading) {

  return null; // ou <Splash />

}

E estruturar as rotas condicionalmente:

TypeScript

Copiar código

return (

  <Routes>

    {user ? (

      <>

        <Route path="/home" element={<Home />} />

        <Route path="/profile" element={<Profile />} />

        <Route path="/waves" element={<Waves />} />

        <Route path="/chat/:id" element={<Chat />} />

        <Route path="/location/:id" element={<Location />} />

        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="*" element={<Navigate to="/home" replace />} />

      </>

    ) : (

      <>

        <Route path="/auth" element={<Auth />} />

        <Route path="*" element={<Navigate to="/auth" replace />} />

      </>

    )}

  </Routes>

);

O que NÃO deve ser feito

Não espalhar if (loading) return null em múltiplas páginas.

Não alterar AuthContext.tsx neste momento.

Não modificar lógica de onAuthStateChange.

O problema está no consumo do estado, não na produção do estado.

Resumo das Alterações

Arquivo

Alteração

App.tsx (ou root de rotas)

Adicionar guard global if (loading) return null antes de renderizar <Routes>

Nenhuma alteração necessária em:

AuthContext.tsx

Auth.tsx

Home.tsx

Outras páginas

Impacto

Elimina completamente a race condition

Remove renderização indevida da tela legada

Mantém arquitetura limpa

Evita duplicação de lógica

Zero impacto no banco ou UX