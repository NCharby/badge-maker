-- Badge Maker - Step 1: Database Migration
-- Execute this file to migrate from JSONB templates to Mustache templates
-- 
-- IMPORTANT: This migration will abandon existing JSONB template configurations
-- The current badge-maker-default template will be replaced with Mustache templates

-- Step 1: Create backup of existing templates
CREATE TABLE IF NOT EXISTS public.templates_backup AS 
SELECT * FROM public.templates;

-- Verify backup was created
SELECT 'Backup created successfully' as status, COUNT(*) as template_count 
FROM public.templates_backup;

-- Step 2: Add new columns to templates table
ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'badge' CHECK (template_type IN ('badge', 'email', 'pdf'));

ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';

-- Step 3: Clear existing template data (JSONB configs are incompatible with Mustache)
-- This will remove the current badge-maker-default template
DELETE FROM public.templates WHERE template_type = 'badge' OR template_type IS NULL;

-- Step 4: Insert COG Classic template (preserves current hardcoded design)
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'cog-classic-2026',
  'COG Classic 2026',
  'COG Classic badge template with decorative frills and gradient background',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to bottom, #0f2733, #170a2a); border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}{{> badge-content }}</div>',
  'badge',
  '1.0.0'
);

-- Step 5: Insert default template (matches current Figma design)
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'badge-maker-default',
  'Badge Maker Default',
  'Default badge template matching current Figma design',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to bottom, #0f2733, #170a2a); border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}{{> badge-content }}</div>',
  'badge',
  '1.0.0'
);

-- Step 6: Change column type from JSONB to TEXT
ALTER TABLE public.templates 
ALTER COLUMN config TYPE TEXT;

-- Step 7: Update events to use new templates
-- Update COG Classic 2026 event to use COG Classic template
UPDATE public.events 
SET template_id = 'cog-classic-2026'
WHERE slug = 'cog-classic-2026';

-- Update default event to use default template
UPDATE public.events 
SET template_id = 'badge-maker-default'
WHERE template_id = 'badge-maker-default' OR template_id IS NULL;

-- Step 8: Verify migration
SELECT 'Migration completed successfully' as status;

-- Verify templates were created
SELECT 
  id, 
  name, 
  template_type, 
  version,
  LENGTH(config) as template_length
FROM public.templates 
WHERE template_type = 'badge'
ORDER BY id;

-- Verify event-template relationships
SELECT 
  e.slug as event_slug,
  e.name as event_name,
  t.id as template_id,
  t.name as template_name,
  t.template_type
FROM public.events e
LEFT JOIN public.templates t ON e.template_id = t.id
ORDER BY e.slug;

-- Show backup information
SELECT 
  'Backup available' as status,
  COUNT(*) as backed_up_templates
FROM public.templates_backup;
