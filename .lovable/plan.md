## Plan: Preserve action context through ProfileGate → Onboarding → return

### Approach

Use **react-router-dom navigation state** to carry the pending action context through the flow. This is transient (lives only in the history entry), requires no localStorage, no globals, and vanishes on refresh (safe fallback to `/location`).

### Flow

```text
1. User selects place → handleSelectPlace(placeId)
2. requireProfile() returns false → modal opens
3. User clicks "Completar perfil"
4. ProfileGateModal navigates to /onboarding with state: { pendingAction: { type: 'selectPlace', placeId } }
5. User completes onboarding
6. Onboarding navigates to /location with state: { pendingAction: { type: 'selectPlace', placeId } }
7. Location.tsx reads state on mount, auto-selects the place and jumps to 'expression' step
```

### Files to change

**1. `src/hooks/useProfileGate.ts**`

- Update requireProfile to accept an optional pendingAction parameter
- When the profile is incomplete, open the modal and store the action temporarily only in the calling component
- The hook should NOT persist the pending action internally
- The hook remains responsible only for determining whether the profile is complete and controlling modal visibility

**2. `src/components/profile/ProfileGateModal.tsx**`

- Accept optional `pendingAction` prop
- Pass it as navigation state when navigating to `/onboarding`:
  ```tsx
  navigate('/onboarding', { state: { pendingAction } });
  ```

**3. `src/pages/Location.tsx**`

- When calling `requireProfile()`, pass the pending action context:
  ```tsx
  // in handleSelectPlace:
  if (!requireProfile({ type: 'selectPlace', placeId })) return;

  // in handleCreateTemporaryPlace:  
  if (!requireProfile({ type: 'createTemp' })) return;
  ```
- Pass `pendingAction` from the Location component state to `ProfileGateModal`
- On mount, read `location.state?.pendingAction`. If present, restore the action:
  - If `type === 'selectPlace'`: set `selectedPlaceId` and jump to `'expression'` step
  - After restoring the action, immediately clear the navigation state using:
    navigate(location.pathname, { replace: true, state: {} });
  - This prevents the pending action from triggering again if the user refreshes the page or navigates back in history.

**4. `src/pages/Onboarding.tsx**`

- Read `location.state?.pendingAction` on mount
- In `handleComplete`, forward it:
  ```tsx
  navigate('/location', { replace: true, state: { pendingAction } });
  ```
- When no `pendingAction` exists (manual access), behave as today

### Type definition

```typescript
interface PendingAction {
  type: 'selectPlace' | 'createTemp';
  placeId?: string;
}
```

### Edge cases handled

- **Manual onboarding access**: No `pendingAction` in state → redirects to `/location` with no state (current behavior)
- **Page refresh during onboarding**: Navigation state is lost → falls back to `/location` normally
- **Profile already complete**: `requireProfile()` returns true, action proceeds immediately, no state stored
- **Google OAuth / email signup**: No `pendingAction` in state → normal flow
- **createTemp without place ID**: Only the step is restored; user fills in the name again (acceptable since the place didn't exist yet)

### No regressions

- `useProfileGate` API is backward-compatible (pendingAction parameter is optional)
- Onboarding completion path unchanged for non-gate flows
- No circular dependencies introduced
- No localStorage, globals, or timeouts