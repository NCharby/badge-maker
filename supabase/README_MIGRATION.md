# Supabase Migration Instructions

## Running the Waivers Migration

To add the waivers table with dietary restrictions and volunteering preferences support:

### 1. Run the Migrations

Execute the migrations in your Supabase SQL editor in this order:

**Step 1: Run the main waivers migration**
```sql
-- Copy and paste the contents of waivers_migration.sql
```

**Step 2: Add dietary and volunteering columns (if needed)**
```sql
-- Copy and paste the contents of add_dietary_volunteering_columns.sql
```

*Note: If you get an error about columns not existing, run the second migration to add the missing columns.*

### 2. Verify the Migration

Check that the tables and columns were created successfully:

```sql
-- Check if waivers table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'waivers';

-- Check waivers table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'waivers'
ORDER BY ordinal_position;

-- Check if sessions table has new columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'sessions'
AND column_name IN ('waiver_completed', 'waiver_id');
```

### 3. Test the Migration

The migration should create:
- `waivers` table with all required fields
- New columns in `sessions` table for waiver tracking
- Proper indexes for performance
- Row Level Security policies
- Triggers for analytics tracking

### 4. Rollback (if needed)

If you need to rollback the migration:

```sql
-- Drop the waivers table
DROP TABLE IF EXISTS public.waivers CASCADE;

-- Remove columns from sessions table
ALTER TABLE public.sessions 
DROP COLUMN IF EXISTS waiver_completed,
DROP COLUMN IF EXISTS waiver_id;

-- Drop triggers
DROP TRIGGER IF EXISTS on_waiver_created ON public.waivers;
DROP TRIGGER IF EXISTS update_waivers_updated_at ON public.waivers;

-- Drop functions
DROP FUNCTION IF EXISTS track_waiver_creation();
```

## Data Flow

After migration, the data flow will be:

1. **Landing Page** → Collects dietary/volunteering data → Stored in Zustand
2. **Waiver Form** → Includes dietary/volunteering data → Sent to PDF API
3. **PDF API** → Stores all data in `waivers` table → Generates PDF
4. **Badge Creation** → Links to waiver via `waiver_id` → Creates badge
5. **Confirmation** → Displays all collected data

## New Fields Added

### Waivers Table:
- `dietary_restrictions` (TEXT[]) - Array of selected dietary restrictions
- `dietary_restrictions_other` (TEXT) - Custom dietary restrictions
- `volunteering_interests` (TEXT[]) - Array of volunteering interests
- `additional_notes` (TEXT) - Free-form notes

### Sessions Table:
- `waiver_completed` (BOOLEAN) - Tracks if waiver is completed
- `waiver_id` (UUID) - References the completed waiver
