#!/usr/bin/env bash
# .claude/hooks/post-edit-lint.sh
#
# PostToolUse hook — runs after Edit, MultiEdit, or Write operations.
# Performs fast, non-blocking checks and prints warnings to Claude's
# context so it can self-correct before proceeding.
#
# Install: referenced in .claude/settings.json hooks config

set -euo pipefail

FILE="${CLAUDE_TOOL_RESULT_PATH:-}"

# If no file path provided, exit cleanly
if [[ -z "$FILE" ]]; then
  exit 0
fi

# Only process TypeScript/JavaScript/SQL files
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.sql) ;;
  *) exit 0 ;;
esac

WARNINGS=()

# ─── SECURITY CHECKS ──────────────────────────────────────────────────────────

# Check for auth.role() misuse in SQL files
if [[ "$FILE" == *.sql ]]; then
  if grep -qE "auth\.role\(\)\s*=\s*'authenticated'" "$FILE" 2>/dev/null; then
    WARNINGS+=("⚠️  RLS SECURITY: Found auth.role() = 'authenticated' in $FILE — this grants ALL authenticated users access to ALL rows. Use auth.uid() = user_id instead.")
  fi

  if grep -qE "FOR ALL\b" "$FILE" 2>/dev/null; then
    WARNINGS+=("⚠️  RLS POLICY: Found FOR ALL policy in $FILE — split into separate SELECT/INSERT/UPDATE/DELETE policies.")
  fi

  if grep -qiE "CREATE POLICY.*FOR UPDATE" "$FILE" 2>/dev/null; then
    if ! grep -qiE "WITH CHECK" "$FILE" 2>/dev/null; then
      WARNINGS+=("⚠️  RLS POLICY: UPDATE policy in $FILE is missing WITH CHECK clause — attacker can change row ownership.")
    fi
  fi

  if grep -qiE "CREATE VIEW" "$FILE" 2>/dev/null; then
    if ! grep -qiE "security_invoker\s*=\s*true" "$FILE" 2>/dev/null; then
      WARNINGS+=("⚠️  RLS VIEW: View in $FILE may bypass RLS — add WITH (security_invoker = true).")
    fi
  fi
fi

# Check for service_role key in wrong context
if [[ "$FILE" == *.ts || "$FILE" == *.tsx || "$FILE" == *.js || "$FILE" == *.jsx ]]; then
  if grep -q "service_role" "$FILE" 2>/dev/null; then
    if grep -q "NEXT_PUBLIC_" "$FILE" 2>/dev/null; then
      WARNINGS+=("🔴  CRITICAL: service_role key reference found near NEXT_PUBLIC_ in $FILE — this would expose it to the client bundle.")
    elif [[ "$FILE" == *"/components/"* || "$FILE" == *"/app/"*"page.tsx" ]]; then
      WARNINGS+=("⚠️  SECURITY: service_role referenced in a likely client-accessible file: $FILE — verify this is server-only.")
    fi
  fi
fi

# ─── TYPESCRIPT CHECKS ────────────────────────────────────────────────────────

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  # Check for `any` types
  ANY_COUNT=$(grep -cE ":\s*any\b|as\s+any\b|<any>" "$FILE" 2>/dev/null || echo 0)
  if [[ "$ANY_COUNT" -gt 0 ]]; then
    WARNINGS+=("⚠️  TYPESCRIPT: $ANY_COUNT instance(s) of 'any' type found in $FILE — use explicit types (strict mode).")
  fi

  # Check for duplicate export patterns
  EXPORT_COUNT=$(grep -cE "^export\s+(default\s+)?(class|function|const|type|interface)\s+\w+" "$FILE" 2>/dev/null || echo 0)
  DEFAULT_EXPORT_COUNT=$(grep -cE "^export default" "$FILE" 2>/dev/null || echo 0)
  if [[ "$DEFAULT_EXPORT_COUNT" -gt 0 ]]; then
    # Allow default exports only for Next.js page/layout files
    if [[ "$FILE" != *"/app/"*"page.tsx" && "$FILE" != *"/app/"*"layout.tsx" && "$FILE" != *"/app/"*"loading.tsx" && "$FILE" != *"/app/"*"error.tsx" && "$FILE" != *"/app/"*"not-found.tsx" ]]; then
      WARNINGS+=("⚠️  TYPESCRIPT: Default export found in $FILE — use named exports only (except Next.js page/layout files).")
    fi
  fi
fi

# ─── NEXT.JS CHECKS ──────────────────────────────────────────────────────────

if [[ "$FILE" == *.tsx || "$FILE" == *.jsx ]]; then
  # Check for "use client" presence
  HAS_USE_CLIENT=$(grep -cE "^['\"]use client['\"]" "$FILE" 2>/dev/null || echo 0)

  if [[ "$HAS_USE_CLIENT" -gt 0 ]]; then
    # Check if it actually needs to be a client component
    HAS_HOOKS=$(grep -cE "\buses(State|Effect|Reducer|Ref|Callback|Memo|Context|Id)\b" "$FILE" 2>/dev/null || echo 0)
    HAS_BROWSER_API=$(grep -cE "\b(window|document|navigator|localStorage|sessionStorage)\b" "$FILE" 2>/dev/null || echo 0)
    HAS_EVENT_HANDLERS=$(grep -cE "\bon[A-Z]\w+\s*=" "$FILE" 2>/dev/null || echo 0)

    if [[ "$HAS_HOOKS" -eq 0 && "$HAS_BROWSER_API" -eq 0 && "$HAS_EVENT_HANDLERS" -eq 0 ]]; then
      WARNINGS+=("⚠️  NEXT.JS: 'use client' found in $FILE but no hooks, browser APIs, or event handlers detected — consider making this a Server Component.")
    fi
  fi

  # Check for bare <img> tags
  if grep -qE "<img\s" "$FILE" 2>/dev/null; then
    WARNINGS+=("⚠️  NEXT.JS: Bare <img> tag found in $FILE — use next/image for optimization.")
  fi
fi

# ─── OUTPUT ───────────────────────────────────────────────────────────────────

if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  CODE CLEANUP HOOK — Issues detected in: $(basename "$FILE")"
  echo "╚══════════════════════════════════════════════════════════════╝"
  for W in "${WARNINGS[@]}"; do
    echo "  $W"
  done
  echo ""
  echo "  Run /cleanup $FILE to auto-fix these issues."
  echo ""
fi

exit 0
