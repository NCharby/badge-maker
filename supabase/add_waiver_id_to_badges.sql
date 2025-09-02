-- Add missing waiver_id column to badges table
-- Run this in Supabase Studio SQL Editor if you're getting the "waiver_id column not found" error

-- Add the missing column
ALTER TABLE public.badges 
ADD COLUMN IF NOT EXISTS waiver_id UUID REFERENCES public.waivers(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_badges_waiver_id ON public.badges(waiver_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'badges' AND column_name = 'waiver_id';
