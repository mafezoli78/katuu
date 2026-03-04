## Plan: Onboarding Gate Refactoring

### Summary

Remove onboarding from the bootstrap flow. Instead, gate presence-activation actions behind a profile-completeness check using a modal.

### Changes

**1. `src/pages/Splash.tsx**` — Remove onboarding redirect

- Remove `useProfile` import and usage
- Remove `profileLoading` and `isProfileComplete` logic
- Simplify: `!user → /auth`, `user → /location`
- Remove dependency on `profile` in useEffect

**2. `src/App.tsx**` — Change default authenticated route

- Change fallback `<Navigate to="/home">` to `<Navigate to="/location">`
- Keep `/onboarding` route available (user can still navigate there explicitly)

**3. `src/components/auth/AuthRegisterStep.tsx**` — After signup, go to `/location` instead of `/onboarding`

- Change `navigate('/onboarding')` to `navigate('/location')`
- Update toast message accordingly

**4. New: `src/components/profile/ProfileGateModal.tsx**` — Modal component

- Receives `open` and `onClose` props
- Displays message: "Complete seu perfil para continuar"
- Explains why (visibility to other users)
- "Completar perfil" button → navigates to `/onboarding`
- "Agora não" button → closes modal

**5. New: `src/hooks/useProfileGate.ts**` — Centralized gate hook

- Uses `useProfile` internally
- Exposes `{ isProfileComplete, requireProfile }` where:
  - `isProfileComplete`: boolean (true when nome + data_nascimento + interests exist)
  - `requireProfile()`: returns true if complete, false + opens modal if not
- Manages modal open state internally
- Exposes `{ isOpen, openModal, closeModal }`
- The modal component must be rendered explicitly in the page and receive those props

**6. `src/pages/Location.tsx**` — Add profile gate before presence activation

- Import `useProfileGate`
- Before `handleActivatePresence` and `handleSelectPlace`, call `requireProfile()`
- If returns false, abort the action (modal shows automatically)
- Render `ProfileGateModal` in the JSX

**7. `src/pages/Onboarding.tsx**` — Update UX

- Keep a defensive guard:
  - If profile is already complete, redirect to `/location`
  - Only allow onboarding to remain open when profile is incomplete
- Keep the redirect-to-location after successful completion (consistent with new default authenticated route)
- Update title to "Complete seu perfil para começar"
- Add explicit "obrigatório" labels on nome and data_nascimento
- Add explanation text about why data is needed

### Files Modified


| File                                          | Action                                 |
| --------------------------------------------- | -------------------------------------- |
| `src/pages/Splash.tsx`                        | Remove profile check, simplify routing |
| `src/App.tsx`                                 | Change default route to `/location`    |
| `src/components/auth/AuthRegisterStep.tsx`    | Navigate to `/location` after signup   |
| `src/components/profile/ProfileGateModal.tsx` | **New** — modal component              |
| `src/hooks/useProfileGate.ts`                 | **New** — centralized gate hook        |
| `src/pages/Location.tsx`                      | Add gate before presence actions       |
| `src/pages/Onboarding.tsx`                    | Remove auto-redirect, improve UX copy  |


### No regressions

- Google OAuth unaffected (goes through Splash → `/location`)
- Email signup → `/location` (instead of `/onboarding`)
- No circular dependencies — `useProfileGate` only depends on `useProfile`
- No timeouts or artificial delays
- `/onboarding` remains accessible, just not forced