## Plan: Stabilize Authentication → Profile → Location Flow

This is a large plan covering 12 sections. I'll organize by priority and group related changes.

---

### SECTION 1 — Centralize profile completeness logic

**File:** `src/utils/profileCompletion.ts` (New)

Create a pure function:

```typescript
export function isProfileComplete(
  profile: { nome?: string | null; data_nascimento?: string | null } | null,
  interests: { length: number }
): boolean {
  return !!profile?.nome && !!profile?.data_nascimento && interests.length >= 3;
}
```

**File:** `src/hooks/useProfile.ts` — Import and use this function instead of inline logic (line 123-125).

**File:** `src/hooks/useProfileGate.ts` — Import from `profileCompletion.ts` instead of duplicating.

**File:** `src/hooks/usePresence.ts` (line 566) — Import and use the same function.

---

### SECTION 2 — Harden ProfileGate (already mostly done)

**File:** `src/hooks/useProfileGate.ts` — Current implementation already stores `pendingAction`, exposes `isOpen`, `openModal`, `closeModal`. Confirm `closeModal` clears `pendingAction` (it does, line 25-28). No changes needed here beyond Section 1 import.

---

### **SECTION 3 — Enforce profile gate before presence activation**

Profile verification must run inside the presence activation flow (before activatePresenceAtPlace) instead of during place selection.

Location.tsx must NOT call requireProfile() during place selection.

Validation rule:

Location.tsx must not import or call useProfileGate or requireProfile() during place selection.

Presence activation must be the only entry point where profile completeness is validated on the frontend.

Profile verification must occur only when the user attempts to activate presence inside the place (before calling activatePresenceAtPlace).

usePresence.ts currently throws PROFILE_INCOMPLETE (line 566-568), but the backend RPC will also enforce this rule (Section 7) as a safety layer.

---

### SECTION 4 & 5 — Preserve/restore pendingAction

PendingAction is only used when the profile gate is triggered during presence activation (activatePresenceAtPlace), not during place selection.

Already implemented via navigation state. ProfileGateModal passes pendingAction to /onboarding.  

After onboarding completion, the app must return to /location and the user can retry activating presence at the selected place. No changes needed.

---

### SECTION 6 — Fix race condition in presence activation

**File:** `src/hooks/usePresence.ts`

The `activatePresenceAtPlace` function (line 561) already checks `profileLoading` and `isProfileComplete()`. However, idempotency is missing.

Add immediately after the profile completeness check and before any RPC call:

```typescript
If presenceLoading is true, the function must return immediately without creating a new activation request.

If activatePresenceAtPlace is triggered while a previous activation promise is still pending, the function must immediately return the same pending promise instead of creating a new activation request.

// Idempotency: if already active at this place, return existing presence
if (currentPresence?.place_id === placeId && currentPresence?.ativo) {
  console.log('[Presence] Already active at this place, returning existing');
  return { error: null, presenceId: currentPresence.id };
}
```

---

### SECTION 7 — Backend safety check (DB migration)

Create a new `activate_presence` RPC version that validates profile completeness before creating presence.

**SQL Migration:**

```sql
-- Add profile completeness check to activate_presence
-- At the start of the function, after advisory lock:
-- Check profile fields
IF NOT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = p_user_id
    AND nome IS NOT NULL
    AND nome <> ''
    AND data_nascimento IS NOT NULL
) THEN
  RAISE EXCEPTION 'PROFILE_INCOMPLETE';
END IF;

-- Check interests
IF NOT EXISTS (
  
SELECT 1
FROM public.user_interests
WHERE user_id = p_user_id
GROUP BY user_id
HAVING COUNT(*) >= 3

) THEN
  RAISE EXCEPTION 'PROFILE_INCOMPLETE';
END IF;
```

This replaces the existing `activate_presence` function, adding these checks after the `pg_advisory_xact_lock` line.

---

### SECTION 8 — Fix location permission screen

**File:** `src/pages/Location.tsx`

The current code (lines 131-158) already does a passive `navigator.permissions.query` check and auto-proceeds if `granted`. The issue is the `setStep` initial value is `'permission'` (line 38), which briefly shows the permission screen.

Fix: Initialize step as `'detecting'` when permission is already granted. Change the mount effect to set step to `'permission'` only when status is NOT granted:

```typescript
// In the permissions query callback:
if (result.state === 'granted') {
  setPermissionStatus('granted');
  setStep('detecting'); // Skip permission screen
  handleRequestLocation();
} else if (result.state === 'denied') {
  setPermissionStatus('blocked');
  setStep('permission');
} else {
  setStep('permission'); // 'prompt' — show the permission screen
}
```

But we need to handle the case where `navigator.permissions` is not available — keep `'permission'` as default. The real fix is to not render the permission UI until we know the status. Add a `permissionChecked` state that starts `false` and show a loader until checked.

const [permissionChecked, setPermissionChecked] = useState(false);

The permission UI must only render when permissionChecked === true.

### SECTION 9 — Improve email signup flow

**File:** `src/components/auth/AuthRegisterStep.tsx`

Changes:

- Remove the disabled email input (email was already entered in previous step)
- Add password confirmation field
- After successful signup, show confirmation message instead of navigating immediately
- Add state `showConfirmation` that renders a "check your email" screen

```tsx
// Add confirm password state
const [confirmPassword, setConfirmPassword] = useState('');

// Validation
if (password !== confirmPassword) {
  toast({ variant: 'destructive', title: 'As senhas não coincidem' });
  return;
}

// After signup success, show confirmation screen instead of navigate
setShowConfirmation(true);

Do not navigate to any route after signup success. The component must remain on the confirmation screen until the user confirms their email and performs login again.
```

The confirmation screen shows: "Enviamos um email de confirmação para {email}. Verifique sua caixa de entrada para ativar sua conta."

---

### SECTION 10 — Prevent UI reset from auth state reload

**File:** `src/contexts/AuthContext.tsx`

The current onAuthStateChange listener sets loading=false on every event. Session and user updates must only occur when their values actually change. The issue is that on `TOKEN_REFRESHED` events, the state change might cause re-renders that trigger navigation effects.

Fix: Only update user/session if they actually changed:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  setSession(prev => {
    if (prev?.access_token === session?.access_token) return prev;
    return session;
  });
  setUser(prev => {
    if (prev?.id === session?.user?.id) return prev;
    return session?.user ?? null;
  });
  setLoading(false);
});
```

---

### SECTION 11 — Stabilize OAuth return flow

**File:** `src/pages/Splash.tsx`

The 2-second timeout (line 26) delays navigation unnecessarily on OAuth return. The splash should navigate immediately once auth state is resolved.

Fix: Remove the `setTimeout` wrapper. Navigate as soon as `authLoading` is false and progress animation completes (or immediately if progress is already done):

```typescript
useEffect(() => {
  if (authLoading) return;
  if (progress < 100) return; // Wait for animation to finish

If progress animation stalls or is skipped, navigation must still occur once authLoading is false.
Progress animation must never block navigation indefinitely.
  
  if (!user) {
    navigate('/auth', { replace: true });
  } else {
    navigate('/location', { replace: true });
  }
}, [user, authLoading, progress, navigate]);
```

---

### SECTION 12 — Acceptance criteria

The following conditions must be verified after implementation:

1. A user with incomplete profile cannot activate presence.

2. Google OAuth login always lands on /location.

3. Email signup shows confirmation screen and does not auto-login.

4. Location permission screen never flashes when permission is already granted.

5. activatePresenceAtPlace never creates duplicate presence records.

The acceptance criteria are met by sections 1-11 combined.

---

### Files Modified Summary


| File                                       | Action                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/utils/profileCompletion.ts`           | **New** — single source of truth for profile completeness                     |
| `src/hooks/useProfile.ts`                  | Use centralized `isProfileComplete`                                           |
| `src/hooks/useProfileGate.ts`              | Use centralized `isProfileComplete`                                           |
| `src/hooks/usePresence.ts`                 | Use centralized `isProfileComplete` + add idempotency check                   |
| `src/pages/Location.tsx`                   | Fix permission screen flash                                                   |
| `src/components/auth/AuthRegisterStep.tsx` | Remove redundant email, add confirm password, show email verification message |
| `src/contexts/AuthContext.tsx`             | Prevent unnecessary re-renders on token refresh                               |
| `src/pages/Splash.tsx`                     | Remove artificial delay, navigate on progress complete                        |
| DB migration                               | Add profile completeness check to `activate_presence` RPC                     |


### No regressions

- Google OAuth: Splash waits for auth → navigates to `/location`
- Email signup: Shows confirmation message, user must verify email
- Profile gate: Unchanged behavior, now with centralized logic
- Presence activation: Backend enforces profile completeness as last line of defense
- No circular dependencies, no timeouts, no localStorage

Plan: Stabilize Authentication → Profile → Location Flow

&nbsp;

This plan consolidates and corrects the previous version to remove ambiguity and ensure Lovable can execute the changes deterministically.

&nbsp;

&nbsp;

&nbsp;

SECTION 1 — Centralize profile completeness logic

&nbsp;

File: src/utils/profileCompletion.ts (New)

&nbsp;

Create the file and add:

&nbsp;

export function isProfileComplete(

  profile: { nome?: string | null; data_nascimento?: string | null } | null,

  interests: { length: number }

): boolean {

  return !!profile?.nome && !!profile?.data_nascimento && interests.length >= 3;

}

&nbsp;

&nbsp;

&nbsp;

File: src/hooks/useProfile.ts

&nbsp;

Substituição:

“No trecho onde existe validação inline de perfil completo (nome, data_nascimento e interests), substituir por uso da função centralizada.”

&nbsp;

Novo trecho:

&nbsp;

import { isProfileComplete } from '@/utils/profileCompletion';

&nbsp;

&nbsp;

&nbsp;

File: src/hooks/useProfileGate.ts

&nbsp;

Substituição:

“Remover qualquer lógica duplicada de validação de perfil e importar a função centralizada.”

&nbsp;

import { isProfileComplete } from '@/utils/profileCompletion';

&nbsp;

&nbsp;

&nbsp;

File: src/hooks/usePresence.ts

&nbsp;

Inserção:

“Adicionar import da função centralizada no topo do arquivo.”

&nbsp;

import { isProfileComplete } from '@/utils/profileCompletion';

&nbsp;

&nbsp;

&nbsp;

SECTION 2 — Remove profile validation from Location selection

&nbsp;

File: src/pages/Location.tsx

&nbsp;

Remoção:

“Remover qualquer import de useProfileGate.”

&nbsp;

Remoção:

“Remover qualquer chamada a requireProfile().”

&nbsp;

Regra obrigatória:

&nbsp;

Location.tsx NÃO pode conter nenhuma verificação de perfil incompleto.

A verificação de perfil só pode ocorrer dentro do fluxo de ativação de presença.

&nbsp;

&nbsp;

&nbsp;

SECTION 3 — Enforce profile validation only inside presence activation

&nbsp;

File: src/hooks/usePresence.ts

&nbsp;

Localizar a função:

&nbsp;

activatePresenceAtPlace

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Adicionar validação de perfil antes de qualquer chamada RPC.”

&nbsp;

if (profileLoading) {

  throw new Error('PROFILE_LOADING');

}

&nbsp;

if (!isProfileComplete(profile, interests)) {

  throw new Error('PROFILE_INCOMPLETE');

}

&nbsp;

&nbsp;

&nbsp;

SECTION 4 — Prevent duplicate presence activation (race condition)

&nbsp;

File: src/hooks/usePresence.ts

&nbsp;

Inserção:

“No escopo superior do hook, antes da função activatePresenceAtPlace.”

&nbsp;

let activationPromise: Promise<any> | null = null;

&nbsp;

&nbsp;

&nbsp;

Inserção:

“No início da função activatePresenceAtPlace.”

&nbsp;

if (activationPromise) {

  return activationPromise;

}

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Envolver a lógica de ativação com promise controlada.”

&nbsp;

activationPromise = (async () => {

&nbsp;

&nbsp;

&nbsp;

Inserção:

“No final da função activatePresenceAtPlace.”

&nbsp;

})();

&nbsp;

activationPromise.finally(() => {

  activationPromise = null;

});

&nbsp;

return activationPromise;

&nbsp;

&nbsp;

&nbsp;

SECTION 5 — Idempotency check for already active presence

&nbsp;

File: src/hooks/usePresence.ts

&nbsp;

Inserção:

“Adicionar antes da chamada RPC que cria presença.”

&nbsp;

if (currentPresence?.place_id === placeId && currentPresence?.ativo) {

  console.log('[Presence] Already active at this place');

  return { error: null, presenceId: currentPresence.id };

}

&nbsp;

&nbsp;

&nbsp;

SECTION 6 — Backend safety validation

&nbsp;

Create a database migration.

&nbsp;

Substituição:

“A função activate_presence deve ser recriada usando CREATE OR REPLACE.”

&nbsp;

&nbsp;

&nbsp;

SQL:

&nbsp;

CREATE OR REPLACE FUNCTION public.activate_presence(

  p_user_id uuid,

  p_place_id uuid

)

RETURNS uuid

LANGUAGE plpgsql

AS $$

BEGIN

&nbsp;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

&nbsp;

  IF NOT EXISTS (

    SELECT 1 FROM public.profiles

    WHERE id = p_user_id

      AND nome IS NOT NULL

      AND nome <> ''

      AND data_nascimento IS NOT NULL

  ) THEN

    RAISE EXCEPTION 'PROFILE_INCOMPLETE';

  END IF;

&nbsp;

  IF NOT EXISTS (

    SELECT 1

    FROM public.user_interests

    WHERE user_id = p_user_id

    GROUP BY user_id

    HAVING COUNT(*) >= 3

  ) THEN

    RAISE EXCEPTION 'PROFILE_INCOMPLETE';

  END IF;

&nbsp;

  RETURN p_place_id;

&nbsp;

END;

$$;

&nbsp;

&nbsp;

&nbsp;

SECTION 7 — Fix location permission screen flashing

&nbsp;

File: src/pages/Location.tsx

&nbsp;

&nbsp;

&nbsp;

Substituição:

“Inicializar estado step.”

&nbsp;

Substituir:

&nbsp;

const [step, setStep] = useState('permission');

&nbsp;

por:

&nbsp;

const [step, setStep] = useState<'permission' | 'detecting' | 'places'>('detecting');

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Criar controle de verificação de permissão.”

&nbsp;

const [permissionChecked, setPermissionChecked] = useState(false);

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Dentro do callback de navigator.permissions.query.”

&nbsp;

setPermissionChecked(true);

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Antes da renderização da UI.”

&nbsp;

if (!permissionChecked) {

  return <LocationLoadingScreen />;

}

&nbsp;

&nbsp;

&nbsp;

SECTION 8 — Improve email signup flow

&nbsp;

File: src/components/auth/AuthRegisterStep.tsx

&nbsp;

&nbsp;

&nbsp;

Remoção:

“Remover campo de email desabilitado.”

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Adicionar campo de confirmação de senha.”

&nbsp;

const [confirmPassword, setConfirmPassword] = useState('');

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Adicionar validação.”

&nbsp;

if (password !== confirmPassword) {

  toast({

    variant: 'destructive',

    title: 'As senhas não coincidem'

  });

  return;

}

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Criar estado de confirmação.”

&nbsp;

const [showConfirmation, setShowConfirmation] = useState(false);

&nbsp;

&nbsp;

&nbsp;

Substituição:

“Após sucesso no cadastro.”

&nbsp;

Substituir navegação automática por:

&nbsp;

setShowConfirmation(true);

&nbsp;

&nbsp;

&nbsp;

Inserção:

“Renderizar tela de confirmação.”

&nbsp;

Enviamos um email de confirmação para {email}.

Verifique sua caixa de entrada para ativar sua conta.

&nbsp;

&nbsp;

&nbsp;

SECTION 9 — Prevent auth state UI reset

&nbsp;

File: src/contexts/AuthContext.tsx

&nbsp;

&nbsp;

&nbsp;

Substituição:

“Atualizar listener onAuthStateChange.”

&nbsp;

supabase.auth.onAuthStateChange((event, session) => {

&nbsp;

  setSession(prev => {

    if (prev?.access_token === session?.access_token) return prev;

    return session;

  });

&nbsp;

  setUser(prev => {

    if (prev?.id === session?.user?.id) return prev;

    return session?.user ?? null;

  });

&nbsp;

  setLoading(false);

&nbsp;

});

&nbsp;

&nbsp;

&nbsp;

SECTION 10 — Stabilize OAuth return flow

&nbsp;

File: src/pages/Splash.tsx

&nbsp;

&nbsp;

&nbsp;

Remoção:

“Remover qualquer setTimeout usado para navegação.”

&nbsp;

&nbsp;

&nbsp;

Substituição:

&nbsp;

useEffect(() => {

&nbsp;

  if (authLoading) return;

&nbsp;

  if (!user) {

    navigate('/auth', { replace: true });

  } else {

    navigate('/location', { replace: true });

  }

&nbsp;

}, [user, authLoading, navigate]);

&nbsp;

&nbsp;

&nbsp;

SECTION 11 — Acceptance criteria

&nbsp;

A implementação só é considerada concluída quando:

&nbsp;

1. Usuário com perfil incompleto NÃO consegue ativar presença.

&nbsp;

2. Login Google sempre redireciona para /location.

&nbsp;

3. Cadastro por email mostra tela de confirmação.

&nbsp;

4. Tela de permissão de localização não pisca quando permissão já existe.

&nbsp;

5. activatePresenceAtPlace nunca cria presença duplicada.

&nbsp;

&nbsp;

&nbsp;

FILES MODIFIED

&nbsp;

src/utils/profileCompletion.ts → novo

&nbsp;

src/hooks/useProfile.ts → usar função centralizada

&nbsp;

src/hooks/useProfileGate.ts → usar função centralizada

&nbsp;

src/hooks/usePresence.ts → validação + idempotência

&nbsp;

src/pages/Location.tsx → correção de permissão

&nbsp;

src/components/auth/AuthRegisterStep.tsx → melhoria signup

&nbsp;

src/contexts/AuthContext.tsx → listener seguro

&nbsp;

src/pages/Splash.tsx → fluxo OAuth

&nbsp;

DB Migration → activate_presence com validação de perfil