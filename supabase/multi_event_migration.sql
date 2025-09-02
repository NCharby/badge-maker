-- Multi-Event Badge Creation Migration
-- Phase 1: Database Foundation
-- This migration adds multi-event support and name field splitting

-- Add events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  template_id TEXT REFERENCES public.templates(id), -- Single template per event
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

-- Insert default event for legacy support
INSERT INTO public.events (slug, name, description, start_date, end_date, template_id) VALUES
('default', 'Default Event', 'Default event for legacy support', NULL, NULL, 'badge-maker-default')
ON CONFLICT (slug) DO NOTHING;

-- Link existing data to default event
UPDATE public.sessions SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.waivers SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.badges SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;

-- Verify migration
SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as events_count FROM public.events;
SELECT COUNT(*) as sessions_with_event FROM public.sessions WHERE event_id IS NOT NULL;
SELECT COUNT(*) as waivers_with_event FROM public.waivers WHERE event_id IS NOT NULL;
SELECT COUNT(*) as badges_with_event FROM public.badges WHERE event_id IS NOT NULL;
SELECT COUNT(*) as waivers_with_names FROM public.waivers WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
