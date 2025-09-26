# Revert Plan: From Dynamic Templates to Hardcoded Badges

## Overview

This document outlines the complete reversion from the Mustache template system back to hardcoded per-event badge previews.

## What We're Reverting

### 1. Database Changes
- Remove `template_type` and `version` columns from `templates` table
- Revert `config` column from `TEXT` back to `JSONB`
- Remove Mustache template data
- Restore original template structure

### 2. Code Changes
- Remove `MustacheBadgePreview` component
- Restore `BadgePreview` component usage
- Remove template service and partials
- Remove template API routes
- Remove test pages

### 3. File Cleanup
- Remove temporary SQL files
- Remove Mustache documentation
- Clean up unused imports

## Revert Steps

### Step 1: Database Reversion
```sql
-- Revert templates table to original structure
ALTER TABLE public.templates 
DROP COLUMN IF EXISTS template_type,
DROP COLUMN IF EXISTS version;

-- Change config column back to JSONB
ALTER TABLE public.templates 
ALTER COLUMN config TYPE JSONB USING config::JSONB;

-- Restore original template data
DELETE FROM public.templates WHERE id IN ('cog-classic-2026', 'badge-maker-default');

-- Insert original template structure
INSERT INTO public.templates (id, name, description, config) VALUES
('badge-maker-default', 'Badge Maker Default', 'Default badge template', '{"type": "badge", "version": "1.0.0"}');
```

### Step 2: Component Reversion
- Restore `BadgePreview` imports in `BadgeCreationForm.tsx`
- Restore `BadgePreview` imports in `ConfirmationPage.tsx`
- Remove `MustacheBadgePreview` component file

### Step 3: API Cleanup
- Remove `src/app/api/templates/[templateId]/route.ts`
- Remove `src/app/test-template/page.tsx`

### Step 4: Library Cleanup
- Remove `src/lib/template-service.ts`
- Remove `src/lib/template-partials.ts`

### Step 5: File Cleanup
- Remove temporary SQL files
- Remove Mustache documentation files
- Update main documentation

## Verification Steps

1. **Database**: Verify templates table structure
2. **Components**: Test badge preview rendering
3. **Pages**: Test badge creation and confirmation flows
4. **Build**: Ensure no TypeScript errors
5. **Functionality**: Verify all features work as before

## Rollback Safety

- All changes are reversible
- Original `BadgePreview.tsx` is preserved
- Database backup exists from migration
- Git history maintains all changes

## Timeline

- **Step 1-2**: Database and component reversion (15 minutes)
- **Step 3-4**: API and library cleanup (10 minutes)
- **Step 5**: File cleanup and verification (10 minutes)
- **Total**: ~35 minutes

## Post-Revert State

After reversion, the system will be in the same state as before the Mustache implementation, with:
- Hardcoded `BadgePreview` component
- Original database schema
- No template service dependencies
- Clean codebase with no unused files
