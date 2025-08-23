-- Migration script to clean up unused tables and fields
-- Run this after applying the updated schema.sql

-- Drop unused tables (if they exist)
DROP TABLE IF EXISTS public.badge_category_assignments;
DROP TABLE IF EXISTS public.badge_categories;

-- Remove unused columns from badges table (if they exist)
ALTER TABLE public.badges DROP COLUMN IF EXISTS original_image_filename;
ALTER TABLE public.badges DROP COLUMN IF EXISTS cropped_image_filename;

-- Remove unused columns from templates table (if they exist)
ALTER TABLE public.templates DROP COLUMN IF EXISTS category;
ALTER TABLE public.templates DROP COLUMN IF EXISTS preview_url;
ALTER TABLE public.templates DROP COLUMN IF EXISTS is_featured;
ALTER TABLE public.templates DROP COLUMN IF EXISTS usage_count;

-- Drop unused enum type (if it exists)
DROP TYPE IF EXISTS template_category;

-- Verify cleanup
SELECT 'Cleanup completed successfully' as status;
