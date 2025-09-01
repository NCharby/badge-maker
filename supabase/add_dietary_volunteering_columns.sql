-- Migration to add dietary restrictions and volunteering preferences columns to existing waivers table
-- Run this after the main schema.sql and waivers_migration.sql

-- Add dietary restrictions and volunteering preferences columns to existing waivers table
ALTER TABLE public.waivers 
ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dietary_restrictions_other TEXT,
ADD COLUMN IF NOT EXISTS volunteering_interests TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- Create indexes for the new array columns (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_waivers_dietary_restrictions ON public.waivers USING GIN(dietary_restrictions);
CREATE INDEX IF NOT EXISTS idx_waivers_volunteering_interests ON public.waivers USING GIN(volunteering_interests);

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'waivers'
  AND column_name IN ('dietary_restrictions', 'dietary_restrictions_other', 'volunteering_interests', 'additional_notes')
ORDER BY column_name;

-- Show success message
SELECT 'Dietary and volunteering columns added successfully to waivers table' as status;
