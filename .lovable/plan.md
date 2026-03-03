

## Diagnostic Summary

### 1. Table `intentions` -- EXISTS with 5 records:

| id | nome | descricao |
|---|---|---|
| `fe9396db-a8d8-4064-a5f5-c1220e6722f1` | Livre | Aberto a qualquer interação |
| `6f8ffec7-b4f8-4452-a1d2-89b3ea7495c4` | Conversar | Bater um papo casual |
| `a13bd937-64fb-49d5-9c85-20abc9da9280` | Conhecer pessoas | Conhecer novas pessoas |
| `f3c354c6-945f-4e15-97e8-7844158855e5` | Companhia | Buscar companhia para o momento |
| `f735afb1-63fc-41ca-8e71-be9316fff554` | Networking | Fazer contatos profissionais |

A intention "Livre" (`fe9396db-...`) is the natural default.

### 2. Column `presence.intention_id`
- **NOT NULL** -- yes, required
- **Foreign key** to `intentions(id)` -- yes, active
- **Being filled** -- yes, via `activate_presence` RPC with `p_intention_id`

### 3. Root cause (frontend)
In `src/pages/Location.tsx` line 45:
```ts
const DEFAULT_INTENTION_ID = '8302ef7d-e40e-494f-9ea3-7cfb52730bb2';
```
This UUID **does not exist** in the `intentions` table. The correct UUID for "Livre" is `fe9396db-a8d8-4064-a5f5-c1220e6722f1`.

### 4. Business model assessment
`intention_id` is still structurally used (passed to `activate_presence`, stored in presence records), but the user never selects it in the current UI -- it's always hardcoded as a default. It remains a structural component but is not actively used for matching/filtering logic on the frontend.

---

## Recommended Fix: Scenario A (minimal, safe)

Since the `intentions` table exists with valid data and the architecture still references it, the fix is simply correcting the hardcoded UUID.

**Single change in `src/pages/Location.tsx`:**
- Replace `'8302ef7d-e40e-494f-9ea3-7cfb52730bb2'` with `'fe9396db-a8d8-4064-a5f5-c1220e6722f1'` (the actual "Livre" record)

No database changes needed. No schema modifications. This is a one-line fix that resolves the FK violation entirely.

