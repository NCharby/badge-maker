# /cleanup — Invoke the code-cleanup agent

Run the AI code quality auditor on the specified target.

## Usage

```
/cleanup                          # Audits entire project
/cleanup app/                     # Audits a directory
/cleanup app/dashboard/page.tsx   # Audits a single file
/cleanup --security-only          # P0 security checks only
/cleanup --sql                    # SQL/migrations only
/cleanup --ts                     # TypeScript issues only
```

## What It Checks

- **P0 Security**: Supabase RLS policies, service_role exposure, Server Action auth
- **P1 TypeScript**: `any` types, duplicate exports, signature mismatches
- **P2 Architecture**: `"use client"` overuse, atomic design violations, App Router misuse
- **P3 Quality**: Inline styles, error handling gaps, date parsing bugs, unused imports

## Behavior

The agent will:
1. Report ALL findings before making any changes
2. Auto-fix P0 (security) and P1 (TypeScript) issues
3. Flag P2 and P3 issues for your review without auto-applying

Files it will never modify without explicit instruction:
- `lib/supabase.ts` or any Supabase client config
- `middleware.ts`
- Any auth provider configuration
- `next.config.*`

$ARGUMENTS
