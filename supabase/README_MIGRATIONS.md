# Supabase Database Setup Guide

This guide covers the complete database setup for the Badge Maker application with waiver signing capabilities.

## Quick Start

For new installations, simply run the consolidated schema file:

```sql
-- Run this in your Supabase SQL Editor
\i schema.sql
```

## What's Included

The `schema.sql` file contains everything needed for a complete setup:

### Tables
- **`sessions`** - User session management with waiver tracking
- **`waivers`** - Legal agreements with dietary/volunteering preferences
- **`templates`** - Badge design templates
- **`badges`** - Generated badges with image data
- **`analytics`** - Event tracking and analytics

### Storage Buckets
- **`badge-images`** - Private storage for badge images (5MB limit)
- **`waiver-documents`** - Private storage for signed waiver PDFs (10MB limit)

### Features
- Row Level Security (RLS) policies for all tables
- Automatic timestamp updates via triggers
- Analytics tracking for badges and waivers
- GIN indexes for array fields (dietary restrictions, volunteering interests)
- Foreign key constraints and referential integrity

## Environment Variables Required

Ensure these environment variables are set in your Supabase project:

```bash
# Storage bucket names (must match schema.sql)
NEXT_PUBLIC_STORAGE_BUCKET_BADGE_IMAGES=badge-images
NEXT_PUBLIC_STORAGE_BUCKET_WAIVER_DOCUMENTS=waiver-documents

# PDF access settings
PDF_ACCESS_EXPIRY_HOURS=24

# Email settings
POSTMARK_API_KEY=your_postmark_api_key
POSTMARK_FROM_EMAIL=your_verified_sender_email
NEXT_PUBLIC_APP_URL=your_app_url

# Waiver version
WAIVER_VERSION=1.0.0
```

## Running the Setup

1. **Open Supabase Dashboard**
   - Go to your project's SQL Editor
   - Create a new query

2. **Run the Schema**
   - Copy the contents of `schema.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

3. **Verify Setup**
   - Check that all tables are created
   - Verify storage buckets exist
   - Confirm RLS policies are active

## Troubleshooting

### Common Issues

**"relation already exists" errors**
- This usually means you're running on an existing database
- The schema uses `CREATE TABLE IF NOT EXISTS` for safety
- Check the Supabase dashboard to see what already exists

**Storage bucket creation fails**
- Ensure you have the necessary permissions
- Check that the bucket names don't conflict with existing ones
- Verify your Supabase plan supports custom storage buckets

**RLS policies not working**
- Check that RLS is enabled on all tables
- Verify the policy names match exactly
- Ensure you're testing with the correct authentication context

### For Existing Installations

If you're upgrading from a previous version:

1. **Backup your data** before making changes
2. **Check existing schema** to avoid conflicts
3. **Run individual sections** if needed (tables, policies, etc.)

## Schema Details

### Waivers Table Structure

```sql
CREATE TABLE public.waivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  emergency_contact TEXT NOT NULL,
  emergency_phone TEXT NOT NULL,
  dietary_restrictions TEXT[] DEFAULT '{}',
  dietary_restrictions_other TEXT,
  volunteering_interests TEXT[] DEFAULT '{}',
  additional_notes TEXT,
  signature_data JSONB,
  signature_image_url TEXT,
  waiver_version TEXT DEFAULT '1.0.0',
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sessions Table Updates

The sessions table now includes waiver tracking:

```sql
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_data JSONB DEFAULT '{}',
  waiver_completed BOOLEAN DEFAULT false,
  waiver_id UUID REFERENCES public.waivers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 hours')
);
```

## Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Private storage buckets** with no public access
- **Signed URL access** for file downloads
- **Audit trails** via analytics tracking
- **Input validation** at the application level

## Performance Considerations

- **GIN indexes** on array fields for fast searches
- **Composite indexes** on frequently queried columns
- **Efficient foreign key relationships**
- **Optimized JSONB queries** for session data

## Next Steps

After running the schema:

1. **Test the application** to ensure database connectivity
2. **Verify storage uploads** work correctly
3. **Check RLS policies** are functioning as expected
4. **Monitor analytics** to ensure tracking is working

## Support

If you encounter issues:

1. Check the Supabase logs in your dashboard
2. Verify all environment variables are set correctly
3. Ensure your Supabase plan supports all required features
4. Check the application logs for specific error messages

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
