## Análise Técnica: "Invalid API Key"

### Causa Raiz Identificada

O problema está no arquivo `src/integrations/supabase/client.ts`, linha 5:

```typescript
const SUPABASE_PUBLISHABLE_KEY = "COLE_A_ANON_AQUI";
```

Este é um placeholder, não a chave real. A evidência está no network request capturado:

```
Header: apikey: COLE_A_ANON_AQUI
Response: {"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}
```

### Diagnóstico ponto a ponto

1. **Variáveis de ambiente vs client.ts**: O arquivo `.env` contém `VITE_SUPABASE_PUBLISHABLE_KEY` com a chave correta, porém o `client.ts` **não usa variáveis de ambiente**. Ele tem valores hardcoded. A URL está correta (`jhpxfvwhcxakzajioxiz.supabase.co`), mas a chave é o placeholder `"COLE_A_ANON_AQUI"`.
2. **URL em uso**: Correta — `https://jhpxfvwhcxakzajioxiz.supabase.co`.
3. **Chave em uso no runtime**: `"COLE_A_ANON_AQUI"` (placeholder inválido).
4. **Integração Lovable-Supabase**: O projeto está conectado ao Supabase project `jhpxfvwhcxakzajioxiz`. A anon key real é `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocHhmdndoY3hha3phamlveGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTI2NjksImV4cCI6MjA4NzM2ODY2OX0.-4soKb5wlgrEQtsfFecDO9RgtImIymcb5RcoY2r2IH0`. Esta chave nunca foi inserida no `client.ts`.
5. **Build atual**: Corresponde ao código visível — o placeholder está no código fonte.

### Conflito

Não há conflito entre múltiplas fontes. O problema é simples: o `client.ts` tem a chave placeholder e nenhum mecanismo (como `import.meta.env`) para ler a chave real do `.env`.

### Correção necessária

Refatorar obrigatoriamente o client.ts para usar import.meta.env.VITE_SUPABASE_URL e import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.

Não utilizar chave hardcoded no código.

### Erro secundário: tipos vazios

O `src/integrations/supabase/types.ts` define `Database` com tabelas vazias (`Tables: {}`, `Functions: {}`), causando todos os erros de build (70+ erros). Os tipos precisam ser regenerados para refletir o schema real do banco.

### Resumo das ações necessárias

1. Corrigir a anon key no `client.ts` (usar a chave real ou `import.meta.env`)
2. Regenerar src/integrations/supabase/types.ts a partir do schema atual do projeto jhpxfvwhcxakzajioxiz, garantindo que todas as tabelas, funções e enums estejam refletidas corretamente no tipo Database.

### Após aplicar as correções:

1. Confirmar que o login funciona no preview.
2. Confirmar que não há mais erros de tipagem no build.
3. Confirmar que as chamadas para /auth/v1/token utilizam a chave correta em runtime.