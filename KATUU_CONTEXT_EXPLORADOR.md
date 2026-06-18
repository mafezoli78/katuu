# KATUU — Modo Explorar (documento de design)

> Documento dedicado ao desenho do **Modo Explorar**. Coexiste com o
> `KATUU_CONTEXT.md` (que continua sendo a fonte da verdade geral do projeto) e
> com o `snapshot_db.md` (schema). Será **unificado ao KATUU_CONTEXT** quando o
> Explorar sair do papel e virar estado consolidado.
> **Versão: 1.2 | Data: 2026-06-17 (manhã) | App alvo: pós-4.0.3**
>
> Status: **MVP TESTADO no APK — funciona, com 5 achados a corrigir (ver §11).**
> Esta fase trata APENAS o Modo Explorar. Katuu Business e paywall Pro são
> futuros conhecidos — só "preparar terreno", não construir (ver §7).
>
> ## ESTADO DE EXECUÇÃO (16/06)
> **Banco — aplicado e validado via SQL (2 users no mesmo local):**
> - Coluna `profiles.visible_in_explore boolean NOT NULL DEFAULT true`.
> - Função `get_place_explore_feed(p_place_id uuid)` SECURITY DEFINER: retorna
>   card reduzido (user_id, nome, checkin_selfie_url, gender, data_nascimento,
>   mutual_interests[], mutual_count). Ordena por mutual_count. Filtros:
>   ativo + expires_at>now() + exclui self + visible_in_explore + block(bilat)
>   + mute(quem me mutou) + suspenso. Gate "pode explorar?" = comentário (hoje
>   liberado a todos). Teste SQL: retornou o presente corretamente. ✅
> **Cliente — implementado e buildado (Claude Code), FALTA testar no APK:**
> - Rota nova `/explore/:placeId` (lazy) + página `src/pages/Explore.tsx`
>   (arquivo próprio — início da futura extração do Location.tsx). Refresh 20s.
> - Botão "Explorar" em PlaceSelector.tsx nos 3 pontos (com stopPropagation).
> - "Entrar" no Explore: lê GPS no clique, valida `PRESENCE_RADIUS_METERS`
>   (150m fixo por ora), navega `/location` com `state.preSelectedPlaceId`
>   (pula a listagem, cai no step expression). Fora do raio → toast.
> **Pendências:** (1) testar ponta a ponta no APK (2 celulares); (2) mapa
> categoria→raio substituindo o 150m fixo (linha ~141 do Explore.tsx, marcado
> por PRESENCE_RADIUS_METERS); (3) `supabase gen types` p/ tirar os `as any`.

---

## 1. O que é o Modo Explorar

Dois modos de relação com um local:

- **Entrar:** presença física confirmada. Cria presença, aparece no feed, interage com todos, é visível. É o "agora é presente" do Katuu.
- **Explorar:** reconhecimento. O usuário vê quem ENTROU num local (cards reduzidos), mas é **totalmente invisível** — não aparece para presentes nem para outros exploradores, não interage, não emite/recebe aceno. Serve para decidir aonde ir antes de ir presencialmente.

Decisão de produto firme (15/06): o Explorar **DEVE** fazer parte do Katuu.

---

## 2. Arquitetura — explorador é LEITOR PURO

**Decisão central, que governa todo o resto:** o explorador **NÃO cria presença** e **não existe no banco**. Explorar = uma consulta de leitura do feed de um local, sem registrar nada.

Consequências (todas a favor):

- **Invisibilidade é propriedade física, não regra a cuidar.** O explorador é invisível porque não há linha dele em lugar nenhum — não há flag que um cliente hackeado possa inverter, não há `SELECT` que alguém possa esquecer de filtrar. Comparado à alternativa (explorador com presença `modo='explorar'` filtrada server-side), esta é radicalmente mais segura: não há o que vazar.
- **Não interage — de graça.** Sem presença, o `send_wave` já barra por co-presença (`WAVE_NO_PRESENCE_SENDER`). Zero código novo para impedir interação do explorador.
- **Sem nó de RLS.** O `get_users_at_place_feed` atual é `SECURITY DEFINER` — já NÃO passa pela RLS de `profiles` (a contorna por design, entrega payload curado). Logo, a função do Explorador pode ser uma variante reduzida dela sem precisar afrouxar a RLS de profiles. O nó que se temia não existe.

**Renderização-espelho:** a visão "explorar" do local X é uma renderização SEPARADA da visão "dentro" do mesmo local — card reduzido, atualizando em tempo real conforme quem entra/sai, mas é um espaço à parte que o explorador lê sem existir nele. Essa separação também é o lugar onde o Katuu Business (futuro) vai customizar a vitrine.

---

## 3. Card reduzido do Explorador

O feed de quem ENTROU (`get_users_at_place_feed`) retorna: nome, foto, bio, nascimento, gender, intenção, `assunto_atual`, `checkin_selfie_url`, interesses, interesses em comum, match_score.

O **card reduzido do Explorador** mostra (CORRIGIDO 17/06):
- **Selfie de check-in** (a única foto que existe — o Katuu não tem foto de perfil, só a selfie do "aqui e agora", decisão de produto).
- **Nome**.
- **Faixa etária (idade) / gênero** (ajuda a decidir).
- **Contagem de pessoas** no local (no topo da renderização).

**CORTA** do explorador: `assunto_atual` (o "momento" escrito para quem está no local), `bio` completa, **e os INTERESSES**.

⚠️ **CORREÇÃO 17/06 (era erro de registro):** os interesses **NÃO aparecem no card**. Eles só servem para **CLASSIFICAR/ORDENAR** o feed (`mutual_count` no `ORDER BY` da função). Razão de produto firme: a lista de interesses é apresentada ao usuário como **NÃO-PÚBLICA** no momento do preenchimento — exibi-la no card do explorador quebraria essa promessa. Versões anteriores deste doc diziam "card mostra interesses em comum" — estava ERRADO. Ver §11.2.

### Privacidade — decisão consciente
O explorador é um **observador assimétrico**: vê sem ser visto, quebrando a reciprocidade do modelo antigo (onde, para ver, você tinha que entrar e logo também ser visto). **Aceito**, porque: (a) é justamente o ponto/diferencial da feature; (b) quem ENTROU consentiu em estar visível; (c) o card reduzido expõe MENOS do que o sistema antigo, em que qualquer um entrava num raio de ~600m e via o card completo de todos; (d) premissa fundadora: "quem não quer ser visto não usa o Katuu". A única coisa que de fato muda vs. antes é a assimetria — e ela é intencional.

### Opção "ficar invisível ao explorador" (decisão 16/06)
Resolve a incógnita "e quem não quer ser visto?". Um campo no **`profiles`** (preferência GLOBAL, não por check-in), **default = visível**. Quem quiser, vai em Configurações e marca para não aparecer ao explorador — continua visível normalmente para quem ENTROU no mesmo local (só some da renderização-espelho do explorador). A função de leitura do explorador filtra `WHERE ... AND <visivel_explorador> = true` — uma linha, trivial graças ao modelo leitor-puro. **Grátis para todos, NÃO é recurso pago** — privacidade não se cobra; cobrar para "não ser observado de longe" seria extorsão de privacidade. (O Explorar em si pode ser Pro; esconder-se dele, não.)

---

## 4. Raios

| Ação | Raio | Observação |
|---|---|---|
| **Listar** locais na Home | 300m → amplia p/ **500m** se não completar 20 locais | preencher a lista de 20 |
| **Buscar** (campo Procurar Locais) | 500m | |
| **Explorar** | qualquer local listado | sem trava |
| **Entrar** | **por categoria** (ver abaixo) | validado no clique do botão |

**Raio de Entrar POR CATEGORIA (decisão 16/06).** Em vez de raio fixo, 3 faixas, aproveitando a curadoria de categorias que JÁ existe na Edge `search-places` (relatório Manus 16/06 — 10 grupos permitidos). Ponto de partida:
- **Pequenos (~75m):** NIGHTLIFE, CAFÉS, DINING, COWORKING, SOCIAL CLUBS — a esmagadora maioria.
- **Médios (~150m):** SHOPPING MALLS, ARTS & ENTERTAINMENT (teatro/cinema/museu).
- **Grandes (~300m):** OUTDOORS & RECREATION (parque/praça), EVENTS (festival/feira), COLLEGE & UNIVERSITY (campus), **e LOCAIS TEMPORÁRIOS** (tipicamente evento/casamento — Fabricio pediu raio maior).

⚠️ Execução (regra 2): o mapa real categoria→faixa depende de confirmar no código/snapshot **como `places.categoria` é populado e quais valores assume** — o relatório descreve os GRUPOS da curadoria, mas o valor gravado em `places.categoria` pode diferir. Confirmar antes de cravar o mapa.

**GPS lido no CLIQUE, não na renderização (decisão 16/06).** O botão Entrar fica **sempre habilitado**; ao clicar, lê o GPS uma vez e valida a distância (provável reuso da validação Haversine que o `confirm_presence` já faz no servidor). Se fora do raio da categoria → avisa "você precisa estar no local para entrar" e não entra. **Vantagem:** não precisa de GPS contínuo na montagem da lista (economiza bateria e simplifica o cliente) — isso REMOVE a complicação antes registrada de "GPS na listagem". A leitura sob demanda no clique vale tanto na Home quanto na tela de explorar (onde também há botão Entrar).

**Mudança de comportamento real:** hoje NÃO há trava de distância na entrada. Com o Explorar, "aparecer = pode explorar, mas Entrar exige estar dentro do raio da categoria".

**Bônus inesperado:** Entrar travado por raio **elimina** o caso "entrei de longe e nunca confirmo" → presença `ativo=true, is_confirmed=false` órfã (causa-raiz do card fantasma de 15/06 manhã).

---

## 5. Confirmação de presença (Entrar) com o Explorar

Explorador não precisa de burocracia (não é visto, não cria presença). Para **Entrar**, a selfie/confirmação continua como hoje — a discutir na execução se o raio por categoria altera o papel do `is_confirmed` e do guard do `end_presence_cascade`. (Hipótese: com Entrar já travado por proximidade, parte da angústia do `is_confirmed` some, mas o fluxo de selfie permanece como prova de "é você, aqui, agora".)

## 5b. Navegação e tempo real (decisões 16/06)

- **Um local por vez.** Mesma regra do "Aqui" atual: para explorar ou entrar, você tem que estar na **Home**; e para estar na Home, não pode estar em nenhum lugar. Não dá para explorar um local estando presente/explorando em outro. Sair do que está explorando para abrir outro. **Benefício:** evita render fantasma ocupando espaço.
- **Fluxo:** Home lista locais → toca em "Explorar" num local → abre a renderização-espelho daquele local → botão "Entrar" disponível ali (GPS validado no clique). Transição explorar→entrar é fluida (não precisa voltar à Home).
- **Tempo real = refresh periódico leve**, não tempo-real-instantâneo. O explorador não precisa ver a entrada no segundo exato; um refresh em intervalo (número a definir na execução — 15s? 30s? "o que satisfaz a curiosidade sem pesar"). **Isso também resolve a carga:** N exploradores no mesmo local não geram N reações por evento; cada um só repede no seu intervalo.
- **Local vazio** é estado válido: a contagem de pessoas já aparece no card ANTES de explorar, então explorar um lugar vazio é escolha consciente (ver o bar às 18h vs 23h é o uso da feature).

---

## 6. Contador de exploradores — ADIADO (v2)

Conceito (sacada do Fabricio): mesmo sem registrar QUEM explora, dá para contar quantas renderizações do local em modo explorar ocorreram → "X explorando", sem ferir a invisibilidade.

**Armadilha a resolver antes de implementar:** o que contar?
- "Aberturas totais" → simples, mas INFLA (mesma pessoa recarregando conta várias vezes; número vira vaidade sem sentido).
- "Exploradores únicos numa janela" → informativo, mas exige um identificador (token de sessão efêmero, não-identificante) para deduplicar — adiciona complexidade.

**Decisão:** adiar para v2. O coração do Explorar é a renderização-espelho; o contador é enfeite. Quando voltar, decidir entre os dois modelos acima.

---

## 7. Preparar terreno para Business / Pro (NÃO construir nesta fase)

Katuu Business = OUTRO app, MESMO banco (specs em `Katuu_Business_*.pdf`). O documento de spec foi escrito ANTES do Explorar — então muda coisa; tratar a spec como referência, não como verdade fechada. Nesta fase, só respeitar dois fatos para não fechar portas:

1. **A renderização do Explorar será customizável pelo Business pago** (cor/logo/slogan do local). → Modelar a função/renderização do Explorar de forma que comporte esses campos depois, sem reescrita. NÃO criar os campos/tabelas de Business agora.
2. **Explorar virará exclusivo do Katuu Pro (usuário pago).** Não haverá Katuu free vs pago de modo geral — mas recursos hoje abertos (Explorar é forte candidato) migrarão para Pro. → O gate "pode explorar?" deve ficar num **ponto único e trocável** (hoje retorna sempre `true`; amanhã consulta o plano do usuário). NÃO modelar plano de usuário agora (sem o desenho do paywall, erra-se a forma).

**Onde fica o gate (decisão 16/06): no BACKEND**, dentro da função de leitura do explorador (`get_place_explore_feed`). Razão (regra 10): quando virar Pro, um gate só no cliente seria burlável — cliente hackeado chamaria a função e exploraria de graça. Então a trava real é server-side. **O cliente também lê o gate**, mas só para apresentação (mostrar a feature ou um aviso). Dois níveis lendo a mesma fonte: backend = trava à prova de hack; cliente = UI. Hoje a função libera para todos; a troca futura é num ponto só. A arquitetura já comporta o aviso de marketing tipo "recurso Pro temporariamente liberado a todos" (camada de apresentação no cliente, lendo o estado do gate) — decisão de produto/marketing futura, não de arquitetura agora.

Ganchos baratos que PODEM ser adicionados se já mexermos em `places` (todos nullable/default, zero impacto no Katuu atual): `is_business bool default false`, `name_override text`, campos de evento (`event_name`, `event_start_at`, `event_end_at`). NÃO criar `business_accounts`, `business_customization`, `business_broadcasts` — pertencem à sessão do Business.

---

## 8. Nomenclatura da Home (decisão 16/06: UX de texto, iterável — NÃO bloqueia)

"Aqui" → **"Entrar"**. Para o título, opções em aberto: "O que você quer fazer agora?" (limpo) ou "Escolha o local e o que quer fazer" (didático). Terceira via: título simples + didática nos botões ("Entrar — estou aqui" / "Explorar — ver de longe"), bom para usuário novo que não conhece a feature. **Decisão:** começar com qualquer uma e ajustar vendo na tela — é UX de texto, troca trivial sem tocar lógica/banco. NÃO é bloqueador de implementação.

## 8b. Filtros de feed — FEATURE FUTURA PRÓPRIA (não nesta fase)

Ideia (Fabricio, 16/06): num local cheio, filtrar quem aparece — por gênero de interesse ("quero ver mulheres"), por categoria de interesse ("quero falar de música/cinema"). **Transversal:** serve tanto o Entrar (feed normal) quanto o Explorar — por isso NÃO é parte do Explorar; é feature própria.
- **Base já existe:** o `get_users_at_place_feed` tem `match_score` que ORDENA por interesses em comum. Filtro é a evolução (de ordenar → esconder quem não bate).
- ⚠️ **Filtro por gênero de interesse é SENSÍVEL** — exige desenho cuidadoso (o Katuu tem `gender` no perfil, mas não modela "quem quero ver"; adicionar isso tem implicações de privacidade e de segurança — não virar ferramenta de assédio direcionado). Merece desenho próprio.
- **NÃO criar schema especulativo agora.** Diferente dos ganchos do Business (que a spec define), o filtro NÃO está desenhado — criar coluna "para o filtro" seria adivinhar a forma de algo indefinido = dívida. "Campo aberto" aqui = anotação no backlog, não coluna no banco. Implementar DEPOIS do Explorar funcionando.

---

## 9. Próximos blocos de execução (ordem sugerida)

Desenho FECHADO e sem névoa após sessões 15-16/06. Ordem de execução:

1. **Função de leitura do Explorador** (SQL, trilha 1 → aplicar): variante reduzida do `get_users_at_place_feed` retornando o card reduzido do §3. `SECURITY DEFINER`. Inclui: gate "pode explorar?" no início (hoje sempre `true`); filtro `visivel_explorador = true`; campos reduzidos. Definir nome (ex.: `get_place_explore_feed`). **Antes:** confirmar no snapshot os campos reais de `get_users_at_place_feed` e como `places.categoria` é populado.
2. **Campo de visibilidade ao explorador** em `profiles` (default visível) + toggle em Configurações.
3. **Mapa categoria→raio** (3 faixas) — confirmar valores reais de `places.categoria` primeiro.
4. **Validação de Entrar no clique** (GPS sob demanda + aviso "precisa estar no local") — reusar Haversine do `confirm_presence` se possível.
5. **Renderização-espelho + refresh periódico leve** (definir intervalo) — escuta provável do canal `places` por `place_id`. Cuidado com RLS/REPLICA IDENTITY já documentados.
6. **Nomenclatura da Home** — UX de texto, iterável, baixo risco.
7. **Faxina/divisão dos arquivos grandes** pode começar JUNTO (Location.tsx 589, usePresence.ts 513).

**Nota:** a decisão "GPS no clique" (não na listagem) REMOVEU a maior complicação de cliente que existia no desenho original — não é mais preciso reformular como a lista é montada.

---

## 10. Pendências gerais do projeto (do KATUU_CONTEXT, não esquecer)

- **Testar cadastro por email no APK** (signup — único item de auth ainda não testado).
- **Rotação da service_role** — subiu de prioridade após o GitHub Push Protection bloquear o segredo hardcoded (15/06). Fazer antes do lançamento; ao reescrever as 3 funções de notificação, parar de hardcodar (usar vault).
- `snapshot_db.md` agora está no `.gitignore` (contém a service_role) — **não versionar**.

---

## 11. ACHADOS DO TESTE NO APK (17/06) — corrigir antes de fechar o Explorar

Teste com 2 celulares no mesmo local (área de bares densa). **Funcionou na espinha:**
A entra → B explora → B vê A. Mas 5 achados:

### 11.1 — [LÓGICA] Selfie de A não apareceu para o explorador B (ícone quebrado)
`get_place_explore_feed` retorna `checkin_selfie_url` = caminho no Storage, NÃO
URL assinada. O Explore.tsx precisa assinar via `getSignedSelfieUrls` igual o
feed de produção (`usePeopleNearby`/PeopleList) já faz e funciona. Investigar no
Claude Code: o Explore está assinando? campo certo? array vazio? Comparar com o
caminho que já funciona no feed interno.

### 11.2 — [REGRA CORRIGIDA] Interesse vazou no card ("churrasco")
**Correção de registro: eu (Claude) havia anotado errado no §3.** A decisão real
sempre foi: **interesses CLASSIFICAM (ordenam) o card, NÃO aparecem nele.** Razão
de produto firme: a lista de interesses é apresentada ao usuário como
**NÃO-PÚBLICA** no preenchimento — expô-la no card quebra essa promessa.
- **Banco:** `get_place_explore_feed` mantém `mutual_count` para ORDENAR
  (`ORDER BY mutual_count DESC`). Pode parar de retornar `mutual_interests[]`
  (o array de nomes) já que não será exibido — ou manter e o cliente ignora.
  Decidir na execução; o essencial é o cliente NÃO renderizar interesses.
- **Cliente:** card do explorador mostra **só: selfie, nome, gênero, idade.**
  Remover a exibição de interesses. (Ver §3 corrigido.)

### 11.3 — [LÓGICA — PRINCIPAL] Trava de Entrar só existe no Explore; "Aqui" não trava
Teste #4: B explorou, clicou Entrar, foi barrado por distância (>150m). Saiu do
Explore, entrou pelo "Aqui" do PlaceSelector no MESMO local — **entrou sem
trava**. Confirma o que o KATUU_CONTEXT já documentava: "Aqui" nunca validou
distância. **DECISÃO FIRME (17/06): a regra de Entrar vale IGUAL nos dois
caminhos.** Senão a trava é teatro — basta sair do Explore e entrar pelo "Aqui".
- **Ação:** extrair a validação de distância que hoje vive só no Explore.tsx e
  aplicá-la também no fluxo "Aqui" do PlaceSelector. Mesma função, mesmo
  comportamento. (A trava em si funciona; o defeito é estar só num lugar.)

### 11.4 — [LÓGICA — INVESTIGAR] Listagem afasta os places da posição real
Teste #5: num ponto cercado de bares, os 20 places apareceram aglomerados a
200-300m de B (visível no mapa), nos DOIS celulares. **Causa identificada por
regressão:** Fabricio confirma que ANTES das novas regras de raio o app
listava os places corretamente ao redor da posição real. Logo **a mudança de
raio na listagem é a causa direta** — não é GPS nem Foursquare. Hipótese: o
filtro/raio novo na listagem (300m→500m) ou o cálculo de distância da lista
está cortando o que está perto e empurrando o centro. **Investigar no Claude
Code:** como a lista é montada hoje (qual GPS usa, qual raio aplica, cálculo de
distância), comparar com o comportamento anterior (proximidade pura, ordenada
por distância, sem corte que afaste).
- ⚠️ Distinto da trava de Entrar (11.3). Aquela funciona; esta é a LISTAGEM.

### 11.5 — [UX — depois] Mensagem "precisa estar no local" é ruim
Trocar texto depois. Primeiro lógica, depois perfumaria (regra do Fabricio).

### Ordem de ataque (17/06): LÓGICA primeiro, UX depois
1. 11.3 — unificar trava de Entrar nos dois caminhos (regra de negócio firme).
2. 11.4 — investigar/consertar a listagem que afasta os places.
3. 11.1 — assinar a selfie no Explore.
4. 11.2 — cortar interesses do card.
5. 11.5 e demais UX — só depois da lógica fechada.

⚠️ **O mapa categoria→raio (§4) ainda não foi aplicado** — o Explore usa 150m
fixo. Ao tratar 11.3/11.4, decidir se o categoria→raio entra agora ou se
primeiro estabiliza com um raio único generoso. Bar (NIGHTLIFE/DINING) é onde o
GPS é PIOR — o ~75m que o §4 propôs para "pequenos" é apertado demais; revisar
para cima na execução.

---

## 12. EXECUÇÃO 17/06 (tarde) — implementado e buildado, AGUARDANDO TESTE DE CAMPO

Sessão longa de implementação via Claude Code (modelo Opus). Lint no baseline
(79 erros pré-existentes, ZERO novos), testes 8/8, build OK. **Nada commitado.**

### 12.1 — Achados FECHADOS no código (faltam testar em campo)

**11.3 (trava de Entrar unificada) — FEITO.** Criado hook
`src/hooks/useValidatePlaceDistance.ts` extraindo a validação de distância que
só existia no Explore. Aplicado nos 4 pontos de entrada: Explore + os 3 do
PlaceSelector (closestPlace, temporários, estabelecimentos). A trava agora vale
igual não importa o caminho. (1ª versão usava raio único; ver 12.2.)

**11.2 (interesse vazou no card) — FEITO.** Removido do `Explore.tsx` o bloco
que renderizava `mutual_interests`. Card do explorador agora = só selfie, nome,
gênero, idade. Os interesses seguem só ORDENANDO o feed no backend
(`mutual_count`), nunca exibidos.

**11.4 + 11.1 (listagem deslocada / "buraco de proximidade") — FEITO.** Esta foi
a investigação central da sessão. **Causa-raiz real** (diferente de todas as
primeiras hipóteses — não era cache, não era coordenada corrompida, não era raio
somado): na Edge `search-places/index.ts`, o SELECT do bounding box cortava com
`.limit(limit * 2)` (=40) ANTES de calcular o Haversine e SEM ordenar por
distância. O Postgres devolvia 40 linhas em ordem física arbitrária, o Haversine
ordenava só essas 40 e cortava 20 — places fisicamente próximos que ficavam fora
das 40 arbitrárias NUNCA apareciam. Resultado: lista mostrava distantes, omitia
próximos (o "buraco de ~300m ao redor" que o Fabricio diagnosticou: a lista
escondia o que estava perto).
- **Correção (Edge):** busca TODOS os candidatos no bounding box do passo (teto
  de segurança `CANDIDATE_FETCH_CAP = 150`, que NÃO é corte por proximidade) →
  curadoria → Haversine → ORDENA → só então `slice(0, 20)`. Passos
  `BOX_STEPS_METERS = [300, 600]`: começa em 300m, expande p/ 600m só se vierem
  <20 curados. `active_users` (presence) contado só no conjunto final de ≤20
  (corrige N+1 de quebra).
- **Correção (cliente):** `Location.tsx fetchPlaces` — removida a expansão
  progressiva tripla (300→600→800); agora 1 chamada única com radius 600
  (Foursquare sempre a 600m; expansão por proximidade vive só na Edge). Imports
  órfãos limpos; `searchByName` mantém MAX_SEARCH_RADIUS (800).
- **Confirmado:** a coordenada do GPS chega CORRETA em todo o caminho (mapa
  mostra a posição certa); o bug era só a ordem das operações na montagem da
  lista.

### 12.2 — Regra de categorias APLICADA (substitui o raio fixo de 11.3)

Novo módulo `src/config/placeCategories.ts` com `getCategoryRadius(categoria,
isTemporary)` e faixas: **pequeno 75m** (bares, restaurantes, cafés, lugares
fechados pequenos), **médio 150m** (salas de espetáculo, shopping, cinema),
**grande 300m** (parques, estádios, espaços abertos). Regras: temporário →
grande (300m); categoria null/desconhecida → fallback médio (150m); Hot Spring →
grande. Normalização case-insensitive + remove acento via `\p{Diacritic}`.
Integrado no `useValidatePlaceDistance` (raio por categoria, não mais o 150m
fixo) e nos 4 pontos de chamada. Servidor (`confirm_presence` ≤300m) intacto — o
maior raio de categoria coincide com o limite do servidor.

### 12.3 — TESTE DE CAMPO pendente (o que validar)

1. **Listagem:** no local de sempre, os places voltam a CERCAR a posição real?
   (shopping e bares próximos que sumiram devem reaparecer; no mapa, a bolinha
   azul cercada de places, não a 300-500m deles).
2. **Trava por categoria:** "Aqui" num bar exige ~75m (colado); num parque
   aceita ~300m. E o problema original sumiu: estando no local, "Aqui" DEIXA
   entrar (antes barrava porque a lista vinha deslocada).
3. Os dois bugs (lista deslocada + "não entro em lugar nenhum") devem morrer
   juntos — eram a mesma raiz.

### 12.4 — Achados NOVOS (abertos, para próxima sessão)

- **[ABERTO] Card de presença não some do Perfil após expiração por tempo.**
  Presença expirou por tempo (sweeper rodou, aviso no local apareceu certo), mas
  ao ir em Perfil pra sair da conta o card pessoal de presença ainda estava lá.
  Hipótese: o Perfil lê a presença de uma fonte que não invalidou (cache no
  cliente, ou query sem filtro `ativo`/`expires_at`). É da MESMA família do bug
  "aceno aceito → chat em andamento": estado dessincronizado entre telas.
  Precisa ver o hook/query que alimenta o card de presença no Perfil.
- **[UX, depois] 11.5** segue pendente (mensagem "precisa estar no local").

### 12.5 — Lições registradas (na memória do Claude Code também)

- **Ordenar antes de cortar:** em lista/ranking, ordenar pelo critério real
  (distância) ANTES de qualquer LIMIT/slice. Um LIMIT sobre ordem física
  descarta itens próximos antes do cálculo — foi o bug do "buraco". Explicar a
  ordem das operações antes de codar busca/feed/ranking.
- **Fonte de verdade do schema:** é o `snapshot_db.md` (raiz, gitignored), NÃO
  as migrations defasadas. O Claude Code não enxerga o snapshot (está no
  .gitignore) — avisar quando precisar de schema.
- **Cuidado com `\u` em tool calls:** caracteres Unicode literais em regex
  corrompem por encoding no pipeline de edição; usar property escapes
  (`\p{Diacritic}`) em vez de ranges de combining marks.
