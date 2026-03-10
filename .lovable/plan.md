## Guided Tutorial (MVP) — Implementation Plan

### 1. Database Migration

Add `tutorial_enabled` column to profiles:

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tutorial_enabled boolean DEFAULT true;
```

No index needed — this is only queried for the current user's own profile.

### 2. Install react-joyride

Add `react-joyride` package for spotlight coach marks.

### 3. New Files

`src/features/tutorial/tutorialSteps.ts` — Define steps targeting elements on the Home page:

| Target ID         | Content                          |

| ----------------- | -------------------------------- |

| `#presence-timer` | Sua presença dura 2 horas...     |

| `#people-feed`    | Pessoas no mesmo lugar agora     |

| `#user-card`      | Veja interesses em comum         |

| `#wave-button`    | Envie um aceno para iniciar chat |

| `#card-slider`    | Arraste para silenciar/bloquear  |

Note: All tutorial steps must target elements that exist in Home.tsx.

The `#moment-field` explanation will be handled later in a dedicated tutorial step when the user first opens `Location.tsx`.

Note: The tutorial only runs on the Home page since all target elements live there. Steps must target only elements that exist in the Home page to avoid missing DOM targets.

Recommended order:

1. presence-timer

2. people-feed

3. user-card

4. wave-button

5. card-slider

`**src/features/tutorial/TutorialOverlay.tsx**` — Wrapper component:

- Reads `profile.tutorial_enabled` from `useProfile()`
- If `false` or profile loading, renders only children
- If `true`, renders `<Joyride>` with steps, continuous mode, skip button
- On finish/skip: calls `updateProfile({ tutorial_enabled: false })`
- Uses `disableScrolling: false` to not block navigation

### 4. Add IDs to Existing Components

`**src/components/home/PresenceStatusCard.tsx**`:

- Wrap timer span with `id="presence-timer"`

`**src/components/home/PeopleList.tsx**`:

- Add `id="people-feed"` to the list container div

`src/components/home/PersonCard.tsx` (first card only):

To avoid duplicate DOM IDs in the feed, tutorial targets must exist only on the first visible card.

- Add prop `isFirst` passed from PeopleList
- Only when `isFirst === true`:
  Add `id="user-card"` to the outer div  
  Add `id="wave-button"` to the CTA Button  
  Add `id="card-slider"` to the swipe container

All other cards must render without these IDs.

`**src/pages/Location.tsx**`:

- Add `id="moment-field"` to the expression Textarea

### 5. Integration

`**src/pages/Home.tsx**` — Wrap content with `<TutorialOverlay>`. The tutorial only triggers on Home since that's where all coached elements are.

### 6. Re-enable Tutorial (Profile Settings)

`**src/pages/Profile.tsx**` — Add a "Mostrar tutorial novamente" button in the settings section that sets `tutorial_enabled = true`.

### Files Changed

- Migration: add `tutorial_enabled` to profiles
- New: `src/features/tutorial/tutorialSteps.ts`, `src/features/tutorial/TutorialOverlay.tsx`
- Edit: `PresenceStatusCard.tsx`, `PeopleList.tsx`, `PersonCard.tsx`, `Home.tsx`, `Profile.tsx`
- Package: add `react-joyride`