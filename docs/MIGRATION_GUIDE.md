# Badge Maker - Database Migration Guide

## 🚨 **Important Migration Notice**

This migration will **abandon existing JSONB template configurations** in favor of Mustache template strings. The existing `badge-maker-default` template and any other badge templates will be replaced with new Mustache-based templates.

## 📋 **Pre-Migration Checklist**

### **1. Backup Current Database**
```sql
-- Create full database backup
pg_dump -h your-host -U your-user -d your-database > badge_maker_backup_$(date +%Y%m%d_%H%M%S).sql

-- Create templates table backup
CREATE TABLE public.templates_backup AS 
SELECT * FROM public.templates;

-- Verify backup
SELECT COUNT(*) FROM public.templates_backup;
SELECT id, name, config FROM public.templates_backup;
```

### **2. Document Current Template Usage**
```sql
-- Check which events are using which templates
SELECT 
  e.slug as event_slug,
  e.name as event_name,
  t.id as template_id,
  t.name as template_name,
  t.config as current_config
FROM public.events e
LEFT JOIN public.templates t ON e.template_id = t.id
ORDER BY e.slug;
```

### **3. Identify Custom Templates**
```sql
-- Check for any custom templates beyond the default
SELECT 
  id,
  name,
  description,
  config,
  is_active,
  created_at
FROM public.templates
WHERE id != 'badge-maker-default'
ORDER BY created_at;
```

## 🔄 **Migration Steps**

### **Step 1: Add New Columns**
```sql
-- Add template type column
ALTER TABLE public.templates 
ADD COLUMN template_type TEXT DEFAULT 'badge' CHECK (template_type IN ('badge', 'email', 'pdf'));

-- Add version column
ALTER TABLE public.templates 
ADD COLUMN version TEXT DEFAULT '1.0.0';

-- Verify new columns
\d public.templates
```

### **Step 2: Clear Existing Badge Templates**
```sql
-- ⚠️ WARNING: This will delete all existing badge templates
-- The JSONB configurations are incompatible with Mustache templates

-- First, check what will be deleted
SELECT id, name, config FROM public.templates 
WHERE template_type = 'badge' OR template_type IS NULL;

-- Delete existing badge templates
DELETE FROM public.templates 
WHERE template_type = 'badge' OR template_type IS NULL;

-- Verify deletion
SELECT COUNT(*) FROM public.templates;
```

### **Step 3: Insert New Mustache Templates**
```sql
-- Insert COG Classic template (current hardcoded design)
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'cog-classic-2026',
  'COG Classic 2026',
  'COG Classic badge template with decorative frills and gradient background',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to bottom, #0f2733, #170a2a); border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}{{> badge-content }}</div>',
  'badge',
  '1.0.0'
),

-- Insert default badge template (matches current Figma design)
(
  'badge-maker-default',
  'Badge Maker Default',
  'Default badge template matching current Figma design with frills and gradient',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to bottom, #0f2733, #170a2a); border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}{{> badge-content }}</div>',
  'badge',
  '1.0.0'
);

-- Insert minimal template example
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'badge-minimal',
  'Minimal Badge Template',
  'Clean, simple badge design without decorative elements',
  '<div class="badge-container" style="width: 284px; height: 400px; background: {{colors.background}}; border-radius: 5px; position: relative; padding: 20px; box-sizing: border-box;">{{#imageUrl}}<div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-bottom: 15px;"><img src="{{imageUrl}}" style="width: 100%; height: 100%; object-fit: cover;" /></div>{{/imageUrl}}<h2 style="font-family: Arial, sans-serif; color: {{colors.text}}; margin: 0 0 10px 0; font-size: 18px;">{{badgeName}}</h2><p style="font-family: Arial, sans-serif; color: {{colors.text}}; margin: 0 0 10px 0; font-size: 14px;">{{email}}</p>{{#socialMediaHandles}}<div style="font-family: Arial, sans-serif; color: {{colors.text}}; font-size: 12px; margin: 5px 0;">{{platform}}: {{handle}}</div>{{/socialMediaHandles}}</div>',
  'badge',
  '1.0.0'
);

-- Insert corporate template example
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'badge-corporate',
  'Corporate Badge Template',
  'Professional corporate-style badge design',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to right, #ffffff, #f8f9fa); border: 2px solid #dee2e6; position: relative; padding: 20px; box-sizing: border-box;"><div style="display: flex; align-items: center; margin-bottom: 20px;">{{#imageUrl}}<div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin-right: 15px;"><img src="{{imageUrl}}" style="width: 100%; height: 100%; object-fit: cover;" /></div>{{/imageUrl}}<div><h2 style="font-family: Helvetica, sans-serif; color: #212529; margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">{{badgeName}}</h2><p style="font-family: Helvetica, sans-serif; color: #6c757d; margin: 0; font-size: 12px;">{{email}}</p></div></div>{{#socialMediaHandles}}<div style="font-family: Helvetica, sans-serif; color: #495057; font-size: 11px; margin: 8px 0; padding: 5px 10px; background: #e9ecef; border-radius: 3px;">{{platform}}: {{handle}}</div>{{/socialMediaHandles}}</div>',
  'badge',
  '1.0.0'
);

-- Verify new templates
SELECT id, name, template_type, version, LENGTH(config) as config_length 
FROM public.templates 
WHERE template_type = 'badge';
```

### **Step 4: Change Column Type**
```sql
-- Change config column from JSONB to TEXT
ALTER TABLE public.templates 
ALTER COLUMN config TYPE TEXT;

-- Verify column type change
\d public.templates
```

### **Step 5: Update Event References**
```sql
-- Update existing events to use the new default template
-- Update COG Classic 2026 event to use COG Classic template
UPDATE public.events 
SET template_id = 'cog-classic-2026'
WHERE slug = 'cog-classic-2026';

-- Update default event to use default template
UPDATE public.events 
SET template_id = 'badge-maker-default'
WHERE template_id = 'badge-maker-default' OR template_id IS NULL;

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
```

## ✅ **Post-Migration Verification**

### **1. Verify Template Structure**
```sql
-- Check all templates
SELECT 
  id,
  name,
  template_type,
  version,
  is_active,
  LENGTH(config) as config_length,
  LEFT(config, 100) as config_preview
FROM public.templates
ORDER BY template_type, name;
```

### **2. Verify Event Relationships**
```sql
-- Check that all events have valid template references
SELECT 
  e.slug,
  e.name,
  t.id as template_id,
  t.name as template_name,
  t.template_type
FROM public.events e
LEFT JOIN public.templates t ON e.template_id = t.id
WHERE t.id IS NULL; -- Should return no rows
```

### **3. Test Template Retrieval**
```sql
-- Test that templates can be retrieved
SELECT config 
FROM public.templates 
WHERE id = 'badge-maker-default' 
AND template_type = 'badge';
```

## 🔄 **Rollback Procedure**

If you need to rollback the migration:

### **1. Restore from Backup**
```sql
-- Drop current templates table
DROP TABLE public.templates;

-- Restore from backup
CREATE TABLE public.templates AS 
SELECT * FROM public.templates_backup;

-- Remove new columns (if they exist)
ALTER TABLE public.templates 
DROP COLUMN IF EXISTS template_type;

ALTER TABLE public.templates 
DROP COLUMN IF EXISTS version;
```

### **2. Restore Database from Full Backup**
```bash
# Stop the application
# Restore from full database backup
psql -h your-host -U your-user -d your-database < badge_maker_backup_YYYYMMDD_HHMMSS.sql
```

## 📊 **Migration Impact**

### **What Will Be Lost**
- ❌ Existing JSONB template configurations
- ❌ Any custom badge templates beyond the default
- ❌ Template configuration history

### **What Will Be Preserved**
- ✅ All event data and relationships
- ✅ All badge data and user information
- ✅ All waiver data
- ✅ All session data
- ✅ Database structure and indexes

### **What Will Be Gained**
- ✅ Flexible Mustache-based templates
- ✅ Easy template editing and versioning
- ✅ Template partials support
- ✅ Conditional rendering capabilities
- ✅ Better template management

## 🚨 **Important Notes**

1. **Backup First**: Always create a full database backup before running this migration
2. **Test Environment**: Run this migration in a test environment first
3. **Downtime**: Plan for brief downtime during the migration
4. **Custom Templates**: Any custom templates will need to be recreated as Mustache templates
5. **Event Impact**: All events will use the new default template initially

## 📞 **Support**

If you encounter issues during migration:
1. Check the backup was created successfully
2. Verify all SQL commands completed without errors
3. Test template retrieval in the application
4. Contact the development team if rollback is needed

---

**Last Updated**: January 2025  
**Migration Version**: 1.0.0  
**Risk Level**: Medium (data loss for template configs)  
**Estimated Downtime**: 5-10 minutes
