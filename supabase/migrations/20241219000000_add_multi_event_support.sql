-- Multi-Event Badge Creation Migration
-- Phase 1: Database Foundation
-- This migration adds multi-event support and name field splitting

-- First, ensure templates table exists (it should be created by schema.sql)
-- If it doesn't exist, create it with basic structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates') THEN
        CREATE TABLE public.templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            config JSONB NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS on templates
        ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
        
        -- Create basic template policy
        CREATE POLICY "Anyone can view active templates" ON public.templates
            FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Add events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  template_id TEXT, -- Initially nullable, will be constrained after data setup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add event_id columns to existing tables
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.waivers 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.badges 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Add separate name fields to waivers table
ALTER TABLE public.waivers 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing full_name data to first_name and last_name
UPDATE public.waivers 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Make name fields required after migration
ALTER TABLE public.waivers 
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON public.sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_waivers_event_id ON public.waivers(event_id);
CREATE INDEX IF NOT EXISTS idx_badges_event_id ON public.badges(event_id);
CREATE INDEX IF NOT EXISTS idx_waivers_names ON public.waivers(first_name, last_name);

-- Enable RLS on new tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view active events" ON public.events
  FOR SELECT USING (is_active = true);

-- Create a default template if none exists
INSERT INTO public.templates (id, name, description, config) VALUES
('badge-maker-default', 'Default Badge Template', 'Default template for badge creation', '{"dimensions": {"width": 3.5, "height": 2.25}, "layout": {"imagePosition": {"x": 0.25, "y": 0.5, "width": 0.4, "height": 0.4}, "textPositions": {"badge_name": {"x": 0.7, "y": 0.3, "width": 0.25, "align": "left"}, "email": {"x": 0.7, "y": 0.5, "width": 0.25, "align": "left"}, "social_media": {"x": 0.7, "y": 0.7, "width": 0.25, "align": "left"}}}}')
ON CONFLICT (id) DO NOTHING;

-- Insert default event for legacy support
INSERT INTO public.events (slug, name, description, start_date, end_date, template_id) VALUES
('default', 'Default Event', 'Default event for legacy support', NULL, NULL, 'badge-maker-default')
ON CONFLICT (slug) DO NOTHING;

-- Now add the foreign key constraint to events table
ALTER TABLE public.events 
ADD CONSTRAINT fk_events_template_id 
FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

-- Link existing data to default event
UPDATE public.sessions SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.waivers SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.badges SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
