Refinamento do Tutorial Katuu — Plano de Implementação

This is a large refactor of src/components/tutorial/TutorialFlow.tsx. The component structure stays the same (8 steps, same props/integration), but each step gets visual and content updates.

Key Design Decisions

- Use design tokens from the app's CSS variables (primary, accent, muted, etc.) instead of hardcoded hex/gray colors

- Use shadcn/ui components (Card, Button, Badge, Input, Textarea) to match the real app

- Import the Katuu logo (src/assets/logo-katuu-oficial.png) for welcome/final screens

- No new dependencies — all animations via Tailwind/CSS

---

Changes by Step

**Step 0 (Welcome):**

- Replace 👋 emoji with Katuu logo image

- Background: gradient matching login (from-[#124854] to-[#1F3A5F]), white text

- Use shadcn Button with bg-accent for "Ver como funciona" and variant="ghost" for skip

- Characters with photos stay as-is (photos are base64-embedded, do not remove them)

**Step 1 (Locais — tooltip/callout flow):**

- Redesign to match real PlaceSelector layout: use shadcn Card, same icon colors, same "Aqui" button styling

- Use the 3 fictional places: Café do Ponto ☕, Parque da Juventude 🌳, Biblioteca Central 📚

- Add sequential tooltip/callout overlay system with state machine: tooltipStep (0–3), each highlights one element:

  - Tooltip 1 → "Aqui" button: "Toque aqui para registrar sua presença neste local."

  - Tooltip 2 → search field: "Não encontrou seu local? Busque pelo nome."

  - Tooltip 3 → "Criar local temporário" button: "Use para locais não cadastrados, eventos corporativos e festas privadas."

  - Tooltip 4 → map toggle icon: "Prefere ver no mapa? Toque aqui para alternar a visualização."

- Each tooltip has a "Próximo" button inside; after tooltip 4, show "Entendi" to advance to next step

- Remove the old simple list+map toggle view

- **Spotlight implementation:** The dark semi-transparent overlay sits at z-index: 9 as a fixed full-screen div. Each highlighted element must have `position: relative; z-index: 10` applied dynamically when it is the active tooltip target. This ensures the spotlight works correctly on all screen sizes including mobile.

**Step 2 (Seu momento aqui):**

- Match real expression screen layout from Location.tsx (same Card, Textarea, spacing)

- Remove the "entered/not-entered" toggle — go straight to the expression view

- Add italic helper text below textarea: "Esta etapa é opcional, mas essencial para boas conexões — diga às pessoas como você está agora."

- Show the presence card on top matching PresenceStatusCard style

- **Duration:** the presence lasts **2 hours** (not 1 hour) and can be renewed. Update any timer mock or text that mentions "1 hora" to "2 horas".

**Step 3 (Selfie):**

- Keep the 3 info cards (Segurança, Confiança, Contexto)

- Make the "how it appears" card match PersonCard layout exactly: photo on left (36% width), name+age+intention on right, rounded-xl, same font sizes as the real app

**Step 4 (Perfil):**

- Add amber alert banner at top using bg-amber-50 border-amber-200 with AlertCircle icon and text: "Esta tela só aparece se você ainda não completou seu perfil."

- **Conditional rendering:** only include this step in the tutorial flow if `!isProfileComplete`. Import `useProfile` and check `isProfileComplete` inside TutorialFlow. If the profile is already complete, skip step 4 automatically (jump from step 3 to step 5). Adjust the total step count and progress dots accordingly.

- Keep rest of the step content as-is

**Step 5 (Pessoas no local):**

- Match Home layout: PresenceStatusCard mock on top (gradient primary), then people list with PersonCard-style cards

- Use the 3 fictional characters (Ana 27, Carlos 38, Marina 24) with their base64 photos already in the component

- Keep wave/accept interaction flow as-is

**Step 6 (Controles — swipe animation):**

- Add CSS @keyframes `tutorial-swipe` in src/index.css:

  ```css

  @keyframes tutorial-swipe {

    0%   { transform: translateX(0); }

    30%  { transform: translateX(-140px); }

    70%  { transform: translateX(-140px); }

    100% { transform: translateX(0); }

  }

  ```

- Apply the animation to the card on mount via useEffect: `animation: tutorial-swipe 2s ease-in-out 0.5s 2 forwards`

- Update Silenciar/Bloquear descriptions to these exact texts:

  **Silenciar:** "Válido apenas naquela sessão e naquele local. As duas pessoas continuam se vendo, mas não conseguem interagir."

  **Bloquear:** "Permanente até que você desbloqueie, independente do local ou sessão. A pessoa bloqueada deixa de ver quem a bloqueou em qualquer local."

**Step 7 (Final):**

- Background: same gradient as welcome/login (dark)

- White text, Katuu logo

- "Começar a usar o Katuu 🚀" with bg-accent styling

- "Ver tutorial novamente" as ghost button

---

General Changes

- Replace all bg-gray-* / text-gray-* with design token equivalents (bg-muted, text-muted-foreground, bg-card, text-foreground, etc.)

- Replace all raw bg-orange-400 with bg-accent text-accent-foreground

- Replace bg-[#1F3A5F] with bg-primary text-primary-foreground where appropriate

- Replace every mention of "1 hora" with "2 horas" throughout the component

- Keep progress dots for steps 1–6 (adjusting count if step 4 is skipped)

- Keep "Pular" button on all intermediate steps

- Add tutorial-swipe keyframe animation in src/index.css

---

Files Modified

- src/components/tutorial/TutorialFlow.tsx — full rewrite of step components

- src/index.css — add tutorial-swipe keyframe animation (4 lines)

Files NOT Modified

- src/hooks/useTutorial.ts — unchanged

- src/App.tsx — unchanged

- src/pages/Profile.tsx — unchanged (reset button already exists)

-