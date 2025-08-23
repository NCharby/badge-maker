# Supabase Setup Instructions

## 🚀 Prerequisites

Before starting, ensure you have:
- A Supabase account (free tier is sufficient)
- Access to your Supabase dashboard
- The project ready for environment variables

## 📋 Step-by-Step Setup

### Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in to your account

2. **Create New Project**
   - Click "New Project"
   - Choose your organization
   - Enter project details:
     - **Name**: `badge-maker` (or your preferred name)
     - **Database Password**: Generate a strong password (save this!)
     - **Region**: Choose closest to your users
   - Click "Create new project"

3. **Wait for Setup**
   - Project creation takes 2-3 minutes
   - You'll see "Project is ready" when complete

### Step 2: Get Project Credentials

1. **Navigate to Settings**
   - In your project dashboard, go to "Settings" → "API"

2. **Copy Credentials**
   - **Project URL**: Copy the "Project URL" (starts with `https://`)
   - **Anon Public Key**: Copy the "anon public" key
   - Save these for your `.env.local` file

### Step 3: Set Up Database Schema

1. **Go to SQL Editor**
   - In your project dashboard, click "SQL Editor"

2. **Run Schema Script**
   - Copy the entire contents of `supabase/schema.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the script

3. **Verify Tables Created**
   - Go to "Table Editor" to confirm these tables exist:
     - `sessions`
     - `badges`
     - `templates`
     - `badge_categories`
     - `badge_category_assignments`
     - `analytics`

### Step 4: Set Up Storage Buckets

1. **Go to Storage**
   - In your project dashboard, click "Storage"

2. **Create Badges Bucket**
   - Click "Create a new bucket"
   - **Name**: `badges`
   - **Public bucket**: ❌ Leave unchecked (images will be proxied through API)
   - Click "Create bucket"

3. **Create Storage Folders**
   - Click on the `badges` bucket
   - Create these folders:
     - `original/` (for original uploaded images)
     - `cropped/` (for processed/cropped images)
     - `temp/` (for temporary uploads)

### Step 5: Configure Storage Policies

1. **Navigate to Storage Policies**
   - In your Supabase dashboard, go to "Storage"
   - Click on the `badges` bucket you created
   - Click the "Policies" tab at the top

2. **Add Read Policy**
   - Click "New Policy" or "Add Policy"
   - Choose "Create a policy from scratch"
   - Fill in the details:
     - **Policy Name**: `Authenticated read access for badge images`
     - **Allowed operation**: `SELECT`
     - **Target roles**: Leave as default (all roles)
     - **Policy definition**: `bucket_id = 'badges'`
   - Click "Review" then "Save policy"

3. **Add Upload Policy**
   - Click "New Policy" again
   - Choose "Create a policy from scratch"
   - Fill in the details:
     - **Policy Name**: `Authenticated upload access`
     - **Allowed operation**: `INSERT`
     - **Target roles**: Leave as default (all roles)
     - **Policy definition**: `bucket_id = 'badges'`
   - Click "Review" then "Save policy"

4. **Add Update Policy** (for editing images)
   - Click "New Policy" again
   - Choose "Create a policy from scratch"
   - Fill in the details:
     - **Policy Name**: `Authenticated update access`
     - **Allowed operation**: `UPDATE`
     - **Target roles**: Leave as default (all roles)
     - **Policy definition**: `bucket_id = 'badges'`
   - Click "Review" then "Save policy"

5. **Add Delete Policy** (for cleanup)
   - Click "New Policy" again
   - Choose "Create a policy from scratch"
   - Fill in the details:
     - **Policy Name**: `Authenticated delete access`
     - **Allowed operation**: `DELETE`
     - **Target roles**: Leave as default (all roles)
     - **Policy definition**: `bucket_id = 'badges'`
   - Click "Review" then "Save policy"

### Step 6: Set Up Environment Variables

1. **Create `.env.local` File**
   - In your project root, create `.env.local`
   - Add your Supabase credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. **Replace Placeholders**
   - Replace `your_project_url_here` with your Project URL
   - Replace `your_anon_key_here` with your Anon Public Key

### Step 7: Test Database Connection

1. **Verify Schema**
   - Go to "Table Editor" in Supabase
   - Confirm all tables are created correctly
   - Check that the `templates` table has the default template

2. **Test API Connection**
   - You can test the connection when we start implementing the API routes

## 🔧 Configuration Details

### Database Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `sessions` | Single-session badge creation | `id`, `session_data`, `expires_at` |
| `badges` | Badge data storage | `id`, `badge_name`, `email`, `social_media_handles` |
| `templates` | Single template configuration | `id`, `config` |
| `analytics` | Usage tracking | `event_type`, `event_data` |

### Storage Structure

```
badges/
├── original/          # Original user uploads
├── cropped/           # Processed/cropped images
└── temp/              # Temporary files (2-hour cleanup)
```

### Security Policies

- **Service Role Access**: Badge images accessed through API proxy
- **Open Upload**: Anyone can upload (for single-session use)
- **RLS Enabled**: Row Level Security is active but permissive

## 🚨 Important Notes

### Security Considerations
- Images are proxied through API routes (no direct public access)
- No authentication is implemented (as per project scope)
- Session data expires after 2 hours
- Temporary files are cleaned up automatically

### Performance Notes
- Free tier includes 500MB database and 1GB storage
- For production, consider upgrading for better performance
- CDN is automatically enabled for storage

### Backup Strategy
- Supabase automatically backs up your database
- Consider exporting schema for version control
- Storage files are replicated for redundancy

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database schema executed successfully
- [ ] Storage bucket created with folders
- [ ] Storage policies configured
- [ ] Environment variables set
- [ ] All tables visible in Table Editor
- [ ] Default template exists in `templates` table

## 🆘 Troubleshooting

### Common Issues

1. **Schema Execution Fails**
   - Check for syntax errors in the SQL
   - Ensure you're in the correct project
   - Try running sections separately

2. **Storage Bucket Not Accessible**
   - Verify bucket is marked as public
   - Check storage policies are applied
   - Ensure folder structure is correct

3. **Environment Variables Not Working**
   - Restart your development server
   - Check for typos in the `.env.local` file
   - Verify the keys are correct

### Getting Help
- Supabase Documentation: [https://supabase.com/docs](https://supabase.com/docs)
- Community Forum: [https://github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)

## 🎯 Next Steps

Once Supabase is set up:
1. Test the connection in your Next.js app
2. Implement the API routes
3. Set up the Supabase client
4. Begin Segment 1 of the implementation plan

Your Supabase backend is now ready for the Badge Maker application!
