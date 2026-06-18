# KATUU — Business (documento de contexto)

> Documento dedicado ao **Katuu Business**. Coexiste com `KATUU_CONTEXT.md`
> (fonte geral), `KATUU_CONTEXT_EXPLORADOR.md` (modo Explorar) e `snapshot_db.md`
> (schema). Será unificado quando o Business sair do papel.
> **Versão: 1.0 | Data: 2026-06-15 (sessão noite) | Status: NÃO em desenvolvimento**
>
> ⚠️ **AVISO DE LEITURA — importante:** este documento sintetiza dois PDFs de
> especificação (`Katuu_Business___Especificação_Técnica__v1_.pdf` e
> `Katuu_Business_-_Visão_Geral.pdf`) que foram escritos **ANTES** do desenho do
> Modo Explorar. O Explorar muda premissas do Business (ver §6). Portanto: tratar
> a spec como **referência/intenção**, NÃO como verdade fechada. O Business
> **não está completamente desenhado** e **não é o trabalho atual** — o foco da
> fase é o Explorar. Este doc existe só para que a próxima conversa entenda do
> que se trata sem reler os PDFs.

---

## 1. O que é o Katuu Business

Versão do Katuu para **estabelecimentos** aproveitarem o movimento de pessoas no espaço deles — transformar presença física em visibilidade e comunicação para o local.

**Fatos estruturais (decididos nesta sessão, 15/06):**
- É **outro app**, que **compartilha o mesmo banco** do Katuu.
- É **pago** — provavelmente só existirá pago (pode haver período de gratuidade/trial, mas não um tier free permanente). A dualidade free/pago acontece no **Katuu** (usuário final), NÃO no Business.
- Voltado ao **dono do estabelecimento**.

O que o dono ganha (visão geral dos PDFs):
- **Destaque na descoberta** — aparecer com mais relevância para quem está decidindo aonde ir.
- **Customização visual** — cor, logo, e o **nome exibido** (inclusive nomes de evento: shows, feiras, convenções).
- **Comunicação com presentes** — mensagens leves (popup/banner) para quem está no local; promoções, avisos. NÃO entra no chat.
- **Controle do próprio local** — sem depender de plataformas externas.
- **Propaganda para o explorador** — o explorador é quem está em decisão de aonde ir, logo é o alvo publicitário de maior valor (acréscimo desta sessão, ligado ao Explorar).

---

## 2. Entidades principais (da spec — sujeitas a revisão pós-Explorar)

> Modelagem proposta nos PDFs. Ainda NÃO existe no banco. Revisar contra o
> `snapshot_db.md` e contra o Explorar antes de implementar.

**Ganchos em `places`** (campos novos, todos nullable/default — baratos de adicionar quando se mexer em places):
`is_business bool default false`, `name_override text`, `event_name`, `event_start_at`, `event_end_at`, `name_score int default 0`, `name_flagged bool default false`, `reported_count int default 0`.

**Tabelas novas** (pertencem à fase Business, NÃO criar antes):
- `business_accounts` — `owner_user_id`, `place_id`, `plan`, `active`. (O dono **reivindica um `place` existente** via `place_id`; não cadastra à parte.)
- `business_customization` — `primary_color`, `logo_url`, `slogan_default`, `slogan_override`.
- `business_broadcasts` — `message`, `type` (popup|banner), `expires_at`.
- `name_changes_log` — auditoria de mudança de nome do local.

---

## 3. Regras de display (da spec)

**Nome exibido:**
```
se now entre event_start_at e event_end_at  → event_name
senão se name_override                       → name_override
senão                                        → name_default
fallback de erro → name_default
```
Rate limit de nome: máx 3 updates / 24h, cooldown 10 min. Validação de nome passiva no MVP (calcula score/flag, sem bloquear).

**Slogan:** `slogan_override` senão `slogan_default`; limite 80 chars; atualização tempo real ou polling leve.

---

## 4. Descoberta e comunicação (da spec)

**Descoberta (pré-presença):** lista ordenada por `score = proximity + active_users + business_boost`. Campos exibidos: nome de display, contagem de ativos, UI custom (se business), slogan.

**Broadcast:** popup (overlay leve, auto-dismiss) ou banner (entre cards). NÃO entra no chat. Rate limit obrigatório: máx 1 / 5 min, máx 10 / dia.

**Painel Business (API, futura):** `GET /business/metrics` (active_users_count), `POST /business/broadcast`, `PATCH /business/customization`, `PATCH /business/name`.

---

## 5. Segurança / privacidade (da spec — princípio firme)

O Business vê **apenas `active_users_count`**. NUNCA vê identidade, perfil, ou localização exata dos usuários. Comunicação é **unidirecional** (dono → presentes). Nenhum dado pessoal exposto ao business. Opt-out futuro possível.

Esse princípio é **compatível** com o Explorar e deve ser preservado: o Business customiza a vitrine e fala com o local, mas não enxerga as pessoas individualmente.

### 5.1 — REMARKETING POR EXPLORAÇÃO (ideia Fabricio 17/06, habilitada pelo `entry_type`)

Quando a presença for unificada com `entry_type` (`presence`/`exploration` — ver `KATUU_CONTEXT.md` épico de centralização), o Katuu passa a ter um dado novo e valioso: **intenção sem presença** — quem explorou um local e não entrou. É o equivalente social do "abandono de carrinho": sinal de interesse latente. Conceito do Fabricio: *"o explorador de ontem pode ser o presente de hoje."* Abre um eixo de monetização forte para o Business (remarketing), que a spec original (só broadcast a presentes) não tinha.

**Modelo de PONTE CEGA (a forma que preserva o anonimato):**
- **O Business vê só AGREGADO:** quantidade de exploradores + faixa etária + gênero + interesses. Suficiente para desenhar uma campanha ("40 exploradores, maioria 25-35, interessados em música ao vivo → noite de jazz"). NUNCA vê identidade de quem explorou.
- **O Business cria a campanha/oferta** baseado nesse agregado.
- **O Katuu DEVOLVE a campanha aos usuários** que se encaixam — do lado de dentro. O estabelecimento NÃO sabe quem recebeu; o usuário não é exposto a ninguém.
- **O Katuu é a ponte cega entre os dois.** É o mesmo modelo de privacidade de plataformas de anúncio sérias: o anunciante segmenta por atributos, a plataforma entrega, o anunciante nunca vê a lista de pessoas. Só o Katuu faz o match, e a serviço do usuário — nunca do anunciante.

**SALVAGUARDAS (questões abertas, desenhar desde a semente — baratas agora, caras depois):**
- **Piso de agregado (k-anonymity):** agregado só é seguro com número grande. Com 2 exploradores ("2 mulheres, 30-35, vinho") dá pra identificar gente real, sobretudo em local pequeno onde o dono conhece a clientela. Regra: só exibir agregado/detalhe com N mínimo de exploradores (ex.: ≥5 ou ≥10); abaixo disso, "poucos exploradores" sem recorte demográfico.
- **Consentimento do usuário:** opt-out de receber campanhas de remarketing (mesma lógica do `visible_in_explore` que já existe — privacidade não se cobra, é escolha). Sem isso vira spam e quebra a confiança que faz o app funcionar.

⚠️ **NÃO construir agora.** Isto é semente registrada para quando o Business for desenhado. Depende do `entry_type` (que vem antes, no épico de centralização) e do próprio Business (futuro). Aqui só fica a direção e as salvaguardas, para a ideia não nascer cruzando a linha do anonimato.

---

## 6. ⚠️ O que o EXPLORAR muda na spec do Business

A spec foi escrita antes do Explorar. Pontos a reconciliar quando o Business for desenhado de verdade:

- **A "descoberta pré-presença" da spec (§4) e o "Explorar" são coisas próximas mas distintas.** A spec trata pré-presença como lista de LOCAIS (nome/slogan/contagem/boost). O Explorar vai além: o usuário entra na renderização-espelho de UM local e vê as PESSOAS (cards reduzidos). A vitrine que o Business customiza é justamente **a página do explorador** — é ali que entra cor/logo/slogan/broadcast para quem está decidindo.
- **Consequência de design:** a renderização do Explorar (a ser construída na fase atual) deve ser modelada de forma a comportar, depois, a customização do Business — sem reescrita. Isso já está registrado como gancho no `KATUU_CONTEXT_EXPLORADOR.md §7`.
- **Broadcast para explorador vs presente:** a spec previa broadcast para quem está NO local. Com o Explorar, surge a possibilidade de propaganda para o EXPLORADOR (alvo de maior valor, em decisão). Isso amplia o conceito de broadcast — a redesenhar. Conecta com o remarketing por exploração (§5.1).
- **Plano:** a spec coloca `plan` em `business_accounts` (do dono). Separado disso, há o **plano do usuário final** (Katuu Pro) que governará o acesso ao Explorar. São dois eixos de monetização distintos; não confundir.

---

## 7. Não-escopo do MVP Business (da spec)

Fora do MVP: chat direto business↔usuário, segmentação avançada, analytics complexo, automações. Feature flags previstas: `ENABLE_NAME_ENFORCEMENT`, `ENABLE_BROADCAST_LIMITS_STRICT`, `ENABLE_EVENT_NAMES`. Integração Foursquare: clonar dados base se existir, senão criar local interno — **o sistema nunca depende exclusivamente do Foursquare.**

---

## 8. Como isso afeta a fase ATUAL (Explorar)

Resumo do que a existência do Business exige da fase atual — e só isso:

1. **NÃO construir nada do Business agora.** Sem tabelas `business_*`, sem painel, sem broadcast.
2. **Preparar terreno barato:** ao mexer em `places` pelo Explorar, os campos `is_business`/`name_override`/evento PODEM ser adicionados (nullable, zero impacto). Opcional.
3. **Modelar a renderização do Explorar** de forma que comporte customização futura (cor/logo/slogan por local) sem reescrita.
4. **Gate de Explorar** num ponto único e trocável (hoje sempre `true`; futuro = Katuu Pro).

Detalhes em `KATUU_CONTEXT_EXPLORADOR.md §7`.
