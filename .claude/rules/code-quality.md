# Code Quality Rules — Auto-loaded by Claude Code
# Covers: Next.js App Router / TypeScript strict / Supabase / Atomic Design
# These rules are enforced by the code-cleanup agent and the post-edit hook.
# Reference: .claude/agents/code-cleanup.md

---

## SUPABASE / POSTGRES RULES

### RLS-001: Always use auth.uid() not auth.role()
NEVER write: `USING (auth.role() = 'authenticated')`
ALWAYS write: `USING (auth.uid() = user_id)`

Reason: auth.role() grants access to ALL rows for any logged-in user.

### RLS-002: No FOR ALL policies
Split every policy into separate SELECT / INSERT / UPDATE / DELETE.

### RLS-003: UPDATE policies require WITH CHECK
```sql
-- Required pattern:
CREATE POLICY "name" ON table FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### RLS-004: Views must use security_invoker
```sql
CREATE VIEW public.my_view
  WITH (security_invoker = true)
  AS SELECT ...;
```

### RLS-005: Index every RLS predicate column
If a policy filters on a column, that column must have an index.

### RLS-006: service_role is server-only
Never reference SUPABASE_SERVICE_ROLE_KEY in:
- Any file imported by a Client Component
- Any NEXT_PUBLIC_ env var
- Any file in /components/ that isn't explicitly server-only

---

## TYPESCRIPT RULES

### TS-001: No any types
TypeScript is in strict mode. `any`, `as any`, and `// @ts-ignore` are banned
except with an explanatory comment and explicit approval.

### TS-002: Named exports only
Use named exports everywhere EXCEPT Next.js required files:
- app/**/page.tsx
- app/**/layout.tsx
- app/**/loading.tsx
- app/**/error.tsx
- app/**/not-found.tsx

### TS-003: Type Server/Client boundaries explicitly
Props passed from Server Components to Client Components must be explicitly typed.
TypeScript cannot infer across this boundary.

### TS-004: Use generated Supabase types
Use `Database['public']['Tables']['tablename']['Row']` from the generated types
file rather than inline object types for Supabase query results.

---

## NEXT.JS APP ROUTER RULES

### NEXT-001: Minimize "use client"
Add "use client" ONLY when the component uses:
- useState, useReducer, useEffect, or other stateful/effect hooks
- Browser APIs (window, document, navigator, etc.)
- Third-party libraries that require client context
- Imperative event handlers requiring reactivity

Static rendering, props-only display, and async data-fetching belong in
Server Components.

### NEXT-002: No async Client Components
Client Components ("use client") cannot be async functions.

### NEXT-003: Server Actions must validate auth server-side
Never trust user_id from the client. Always:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Unauthorized');
```

### NEXT-004: Validate inputs with Zod in Server Actions
All Server Actions must validate inputs before any DB operation.

### NEXT-005: Use next/image
Never use bare <img> tags. Always use next/image.

### NEXT-006: Revalidate after mutations
Server Actions that mutate data must call revalidatePath() or revalidateTag().

---

## ATOMIC DESIGN RULES

### ATOMIC-001: Atoms are pure UI
Atoms accept props and render UI. No hooks beyond useState for local UI state,
no Supabase calls, no business logic.

### ATOMIC-002: Data fetching belongs at the page boundary
Supabase queries happen in Server Component pages/layouts, not in organisms,
molecules, or atoms. Data flows down as props.

### ATOMIC-003: Client-side data hooks are isolated
If a component genuinely needs client-side data fetching (real-time, user-
triggered), put the query logic in a dedicated hook file (hooks/useXxx.ts),
not inline in the component.

---

## GENERAL QUALITY RULES

### QUAL-001: No inline styles
Use Tailwind utility classes. Never use style={{...}}.

### QUAL-002: Parse YYYY-MM-DD dates as local time
```typescript
// WRONG — parses as UTC midnight, shows previous day in UTC- timezones
new Date('2025-01-15')

// CORRECT — parses as local midnight
new Date('2025-01-15T00:00:00')
```

### QUAL-003: All async operations need error handling
Every await must be in a try/catch or use .catch(). Components must render
error states, not just happy paths.

### QUAL-004: Don't install dependencies without asking
If a task would require a new npm package, stop and ask first.

### QUAL-005: Don't modify core config files
These files are protected — never modify without explicit instruction:
- lib/supabase.ts (or equivalent Supabase client config)
- middleware.ts
- next.config.ts / next.config.js
- Any auth provider configuration
