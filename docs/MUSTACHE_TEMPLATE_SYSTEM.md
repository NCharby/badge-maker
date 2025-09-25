# Badge Maker - Mustache Template System Design

## 🎯 **Overview**

This document outlines the design for implementing a Mustache-based template system for badge rendering. This approach leverages the existing Mustache infrastructure used in the email system and provides a more flexible, maintainable solution than JSONB configuration.

## 🚀 **Why Mustache Templates?**

### **Advantages Over JSONB Configuration**
- **Familiar Syntax**: Already used in email system (Postmark templates)
- **String Storage**: Simple TEXT field in database, easy to edit and version
- **Flexible Logic**: Conditional rendering, loops, and partials
- **Human Readable**: Templates are easy to understand and modify
- **Version Control Friendly**: Text-based templates work well with Git
- **No Schema Changes**: Can evolve templates without database migrations

### **Existing Infrastructure**
- ✅ Postmark already uses Mustache templates for emails
- ✅ Team is familiar with Mustache syntax
- ✅ Template validation and error handling patterns exist
- ✅ No new dependencies required

## 🏗️ **System Architecture**

### **Database Schema Changes**
```sql
-- Update templates table to use TEXT instead of JSONB
ALTER TABLE public.templates 
ALTER COLUMN config TYPE TEXT;

-- Add template type for different rendering contexts
ALTER TABLE public.templates 
ADD COLUMN template_type TEXT DEFAULT 'badge' CHECK (template_type IN ('badge', 'email', 'pdf'));

-- Add template version for tracking changes
ALTER TABLE public.templates 
ADD COLUMN version TEXT DEFAULT '1.0.0';
```

### **Template Storage Structure**
```sql
-- Example template record
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'badge-default-v1',
  'Default Badge Template',
  'Standard badge layout with frills and gradient',
  '<div class="badge-container" style="...">{{> badge-content }}</div>',
  'badge',
  '1.0.0'
);
```

## 🎨 **Template Design**

### **Template Structure**
```html
<!-- Badge Container Template -->
<div class="badge-container" 
     style="
       width: {{dimensions.width}}px; 
       height: {{dimensions.height}}px;
       background: {{#colors.gradient}}linear-gradient({{direction}}, {{from}}, {{to}}){{/colors.gradient}}{{^colors.gradient}}{{colors.background}}{{/colors.gradient}};
       border-radius: {{decorations.borderRadius}}px;
       position: relative;
       overflow: hidden;
     ">
  
  <!-- Decorative Elements -->
  {{#decorations.frills}}
    {{> frill-elements }}
  {{/decorations.frills}}
  
  <!-- Main Content -->
  {{> badge-content }}
  
</div>
```

### **Badge Content Partial**
```html
<!-- badge-content.mustache -->
<div class="badge-content" style="position: relative; width: 100%; height: 100%;">
  
  <!-- Profile Image -->
  {{#imageUrl}}
    <div class="image-container" 
         style="
           position: absolute;
           left: {{layout.imagePosition.x}}%;
           top: {{layout.imagePosition.y}}%;
           width: {{layout.imagePosition.width}}%;
           height: {{layout.imagePosition.height}}%;
           border-radius: 50%;
           overflow: hidden;
         ">
      <img src="{{imageUrl}}" 
           alt="Profile photo"
           style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  {{/imageUrl}}
  
  <!-- Badge Name -->
  <div class="badge-name" 
       style="
         position: absolute;
         left: {{layout.textPositions.badge_name.x}}%;
         top: {{layout.textPositions.badge_name.y}}%;
         width: {{layout.textPositions.badge_name.width}}%;
         text-align: {{layout.textPositions.badge_name.align}};
         font-family: {{fonts.badge_name}};
         color: {{colors.text}};
         font-size: {{typography.badge_name.fontSize}}px;
         font-weight: {{typography.badge_name.fontWeight}};
       ">
    {{badgeName}}
  </div>
  
  <!-- Email -->
  <div class="email" 
       style="
         position: absolute;
         left: {{layout.textPositions.email.x}}%;
         top: {{layout.textPositions.email.y}}%;
         width: {{layout.textPositions.email.width}}%;
         text-align: {{layout.textPositions.email.align}};
         font-family: {{fonts.email}};
         color: {{colors.text}};
         font-size: {{typography.email.fontSize}}px;
       ">
    {{email}}
  </div>
  
  <!-- Social Media -->
  <div class="social-media" 
       style="
         position: absolute;
         left: {{layout.textPositions.social_media.x}}%;
         top: {{layout.textPositions.social_media.y}}%;
         width: {{layout.textPositions.social_media.width}}%;
         text-align: {{layout.textPositions.social_media.align}};
         font-family: {{fonts.social_media}};
         color: {{colors.text}};
         font-size: {{typography.social_media.fontSize}}px;
       ">
    {{#socialMediaHandles}}
      <div class="social-handle">
        {{#platformIcon}}<img src="{{platformIcon}}" alt="{{platform}}" style="width: 16px; height: 16px; margin-right: 4px;" />{{/platformIcon}}
        {{platform}}: {{handle}}
      </div>
    {{/socialMediaHandles}}
  </div>
  
</div>
```

### **Frill Elements Partial**
```html
<!-- frill-elements.mustache -->
<div class="frill-elements" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
  <img src="/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg" 
       class="frill-left" 
       style="position: absolute; top: 0; left: 0;" />
  <img src="/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg" 
       class="frill-right" 
       style="position: absolute; top: 0; right: 0;" />
  <img src="/assets/2c6cb173ab669ace01ece5b59fa70abcc55efcec.svg" 
       class="frill-lower" 
       style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" />
</div>
```

## 🔧 **Implementation**

### **Template Service**
```typescript
// src/lib/mustache-template-service.ts
import Mustache from 'mustache';

export interface BadgeTemplateData {
  // Layout data
  dimensions: {
    width: number;
    height: number;
  };
  layout: {
    imagePosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    textPositions: {
      badge_name: { x: number; y: number; width: number; align: string };
      email: { x: number; y: number; width: number; align: string };
      social_media: { x: number; y: number; width: number; align: string };
    };
  };
  
  // Styling data
  colors: {
    background: string;
    text: string;
    gradient?: {
      direction: string;
      from: string;
      to: string;
    };
  };
  fonts: {
    badge_name: string;
    email: string;
    social_media: string;
  };
  typography: {
    badge_name: { fontSize: number; fontWeight: string };
    email: { fontSize: number };
    social_media: { fontSize: number };
  };
  
  // Content data
  badgeName: string;
  email: string;
  imageUrl?: string;
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
    platformIcon?: string;
  }>;
  
  // Decorative elements
  decorations: {
    frills: boolean;
    borderRadius: number;
    shadows: boolean;
  };
}

export class MustacheTemplateService {
  private partials: Map<string, string> = new Map();
  
  constructor() {
    this.loadPartials();
  }
  
  private async loadPartials() {
    // Load partial templates
    this.partials.set('badge-content', await this.loadPartial('badge-content'));
    this.partials.set('frill-elements', await this.loadPartial('frill-elements'));
  }
  
  private async loadPartial(name: string): Promise<string> {
    // Load partial from database or file system
    const response = await fetch(`/api/templates/partials/${name}`);
    return await response.text();
  }
  
  async renderBadge(templateId: string, data: BadgeTemplateData): Promise<string> {
    // Get template from database
    const template = await this.getTemplate(templateId);
    
    // Render with Mustache
    return Mustache.render(template, data, this.partials);
  }
  
  private async getTemplate(templateId: string): Promise<string> {
    const response = await fetch(`/api/templates/${templateId}`);
    const { config } = await response.json();
    return config;
  }
  
  validateTemplate(template: string): boolean {
    try {
      // Test render with empty data to validate syntax
      Mustache.render(template, {}, {});
      return true;
    } catch (error) {
      console.error('Template validation failed:', error);
      return false;
    }
  }
}
```

### **Dynamic Badge Preview Component**
```typescript
// src/components/organisms/MustacheBadgePreview.tsx
import { useEffect, useState } from 'react';
import { MustacheTemplateService, BadgeTemplateData } from '@/lib/mustache-template-service';
import { useBadgeStore } from '@/hooks/useBadgeStore';

interface MustacheBadgePreviewProps {
  templateId: string;
  badgeData?: {
    badge_name?: string;
    email?: string;
    social_media_handles?: Array<{ platform: string; handle: string }>;
  };
  imageUrl?: string;
}

export function MustacheBadgePreview({ 
  templateId, 
  badgeData, 
  imageUrl 
}: MustacheBadgePreviewProps) {
  const { data, originalImage, croppedImage } = useBadgeStore();
  const [renderedHTML, setRenderedHTML] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const displayData = badgeData || data;
  const displayImage = imageUrl || croppedImage || originalImage;
  
  useEffect(() => {
    const renderBadge = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const templateService = new MustacheTemplateService();
        
        // Prepare template data
        const templateData: BadgeTemplateData = {
          dimensions: { width: 284, height: 400 },
          layout: {
            imagePosition: { x: 25, y: 50, width: 40, height: 40 },
            textPositions: {
              badge_name: { x: 70, y: 30, width: 25, align: 'left' },
              email: { x: 70, y: 50, width: 25, align: 'left' },
              social_media: { x: 70, y: 70, width: 25, align: 'left' }
            }
          },
          colors: {
            background: '#ffffff',
            text: '#ffffff',
            gradient: {
              direction: 'to bottom',
              from: '#0f2733',
              to: '#170a2a'
            }
          },
          fonts: {
            badge_name: 'Montserrat',
            email: 'Open Sans',
            social_media: 'Open Sans'
          },
          typography: {
            badge_name: { fontSize: 18, fontWeight: 'bold' },
            email: { fontSize: 14 },
            social_media: { fontSize: 12 }
          },
          badgeName: displayData?.badge_name || 'Badge Name',
          email: displayData?.email || 'email@example.com',
          imageUrl: displayImage,
          socialMediaHandles: displayData?.social_media_handles?.map(handle => ({
            platform: handle.platform,
            handle: handle.handle,
            platformIcon: `/assets/social-icons/${handle.platform}-icon-white.svg`
          })) || [],
          decorations: {
            frills: true,
            borderRadius: 10,
            shadows: true
          }
        };
        
        const html = await templateService.renderBadge(templateId, templateData);
        setRenderedHTML(html);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Template rendering failed');
      } finally {
        setLoading(false);
      }
    };
    
    renderBadge();
  }, [templateId, displayData, displayImage]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-white">Loading badge preview...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-center items-center min-h-[400px]">
      <div 
        className="badge-preview-container"
        dangerouslySetInnerHTML={{ __html: renderedHTML }}
      />
    </div>
  );
}
```

### **Template API Endpoints**
```typescript
// src/app/api/templates/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .eq('template_type', 'badge')
      .single();
    
    if (error || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      config: template.config, // Mustache template string
      version: template.version,
      isActive: template.is_active
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// src/app/api/templates/partials/[name]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { name } = params;
    
    // Load partial from database or file system
    const partials = {
      'badge-content': await loadBadgeContentPartial(),
      'frill-elements': await loadFrillElementsPartial(),
    };
    
    const partial = partials[name as keyof typeof partials];
    
    if (!partial) {
      return NextResponse.json(
        { error: 'Partial not found' },
        { status: 404 }
      );
    }
    
    return new Response(partial, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    console.error('Error loading partial:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## 🎨 **Template Examples**

### **Default Template (Current Figma Design)**
```html
<div class="badge-container" 
     style="
       width: 284px; 
       height: 400px;
       background: linear-gradient(to bottom, #0f2733, #170a2a);
       border-radius: 10px;
       position: relative;
       overflow: hidden;
       box-shadow: 0 4px 8px rgba(0,0,0,0.3);
     ">
  
  {{#decorations.frills}}
    {{> frill-elements }}
  {{/decorations.frills}}
  
  {{> badge-content }}
  
</div>
```

### **Minimal Template**
```html
<div class="badge-container" 
     style="
       width: 284px; 
       height: 400px;
       background: {{colors.background}};
       border-radius: 5px;
       position: relative;
       padding: 20px;
       box-sizing: border-box;
     ">
  
  {{#imageUrl}}
    <div style="
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      overflow: hidden; 
      margin-bottom: 15px;
    ">
      <img src="{{imageUrl}}" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  {{/imageUrl}}
  
  <h2 style="
    font-family: Arial, sans-serif;
    color: {{colors.text}};
    margin: 0 0 10px 0;
    font-size: 18px;
  ">{{badgeName}}</h2>
  
  <p style="
    font-family: Arial, sans-serif;
    color: {{colors.text}};
    margin: 0 0 10px 0;
    font-size: 14px;
  ">{{email}}</p>
  
  {{#socialMediaHandles}}
    <div style="
      font-family: Arial, sans-serif;
      color: {{colors.text}};
      font-size: 12px;
      margin: 5px 0;
    ">{{platform}}: {{handle}}</div>
  {{/socialMediaHandles}}
  
</div>
```

### **Corporate Template**
```html
<div class="badge-container" 
     style="
       width: 284px; 
       height: 400px;
       background: linear-gradient(to right, #ffffff, #f8f9fa);
       border: 2px solid #dee2e6;
       position: relative;
       padding: 20px;
       box-sizing: border-box;
     ">
  
  <div style="display: flex; align-items: center; margin-bottom: 20px;">
    {{#imageUrl}}
      <div style="
        width: 60px; 
        height: 60px; 
        border-radius: 50%; 
        overflow: hidden; 
        margin-right: 15px;
      ">
        <img src="{{imageUrl}}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
    {{/imageUrl}}
    
    <div>
      <h2 style="
        font-family: Helvetica, sans-serif;
        color: #212529;
        margin: 0 0 5px 0;
        font-size: 16px;
        font-weight: bold;
      ">{{badgeName}}</h2>
      
      <p style="
        font-family: Helvetica, sans-serif;
        color: #6c757d;
        margin: 0;
        font-size: 12px;
      ">{{email}}</p>
    </div>
  </div>
  
  {{#socialMediaHandles}}
    <div style="
      font-family: Helvetica, sans-serif;
      color: #495057;
      font-size: 11px;
      margin: 8px 0;
      padding: 5px 10px;
      background: #e9ecef;
      border-radius: 3px;
    ">{{platform}}: {{handle}}</div>
  {{/socialMediaHandles}}
  
</div>
```

## 🔄 **Migration Strategy**

### **Phase 1: Database Migration**

#### **Step 1: Backup Existing Data**
```sql
-- Create backup table before migration
CREATE TABLE public.templates_backup AS 
SELECT * FROM public.templates;

-- Verify backup
SELECT COUNT(*) FROM public.templates_backup;
```

#### **Step 2: Add New Columns**
```sql
-- Add template type and version columns
ALTER TABLE public.templates 
ADD COLUMN template_type TEXT DEFAULT 'badge' CHECK (template_type IN ('badge', 'email', 'pdf'));

ALTER TABLE public.templates 
ADD COLUMN version TEXT DEFAULT '1.0.0';
```

#### **Step 3: Clear Existing Template Data**
```sql
-- Clear existing JSONB configs since they're incompatible with Mustache
-- The existing badge-maker-default template will be recreated with Mustache syntax
DELETE FROM public.templates WHERE template_type = 'badge' OR template_type IS NULL;
```

#### **Step 4: Insert New Mustache Templates**
```sql
-- Insert default badge template with Mustache syntax
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'badge-maker-default',
  'Badge Maker Default',
  'Default badge template matching current Figma design',
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
```

#### **Step 5: Change Column Type**
```sql
-- Change config column from JSONB to TEXT
ALTER TABLE public.templates 
ALTER COLUMN config TYPE TEXT;
```

#### **Step 6: Update Events to Use New Templates**
```sql
-- Update existing events to use the new default template
UPDATE public.events 
SET template_id = 'badge-maker-default'
WHERE template_id = 'badge-maker-default' OR template_id IS NULL;

-- Verify the migration
SELECT e.slug, e.name, t.id as template_id, t.name as template_name, t.template_type
FROM public.events e
LEFT JOIN public.templates t ON e.template_id = t.id;
```

### **Phase 2: Template System Implementation**
1. Install Mustache.js dependency
2. Create MustacheTemplateService
3. Implement template API endpoints
4. Create MustacheBadgePreview component
5. Add partial template support

### **Migration Considerations**

**⚠️ Important**: The existing JSONB template configurations will be abandoned during this migration. The current `badge-maker-default` template and any other badge templates will be replaced with new Mustache-based templates.

**Migration Steps**:
1. **Backup**: Create full database backup before migration
2. **Clear**: Remove existing JSONB template configurations
3. **Insert**: Add new Mustache templates with proper syntax
4. **Update**: Change column type from JSONB to TEXT
5. **Verify**: Ensure all events reference valid templates

See `MIGRATION_GUIDE.md` for detailed migration instructions and rollback procedures.

### **Phase 3: Event Integration**
1. Update event pages to use Mustache templates
2. Modify BadgeCreationForm to use new preview component
3. Add template validation and error handling
4. Implement fallback to hardcoded design

### **Phase 4: Template Management**
1. Create template CRUD operations
2. Add template validation
3. Create template editor interface
4. Add template versioning

## 🧪 **Testing Strategy**

### **Template Validation**
```typescript
// src/lib/__tests__/mustache-template-service.test.ts
describe('MustacheTemplateService', () => {
  it('should render valid template', async () => {
    const service = new MustacheTemplateService();
    const template = '<div>{{badgeName}}</div>';
    const data = { badgeName: 'Test Badge' };
    
    const result = await service.renderBadge('test-template', data);
    expect(result).toContain('Test Badge');
  });
  
  it('should validate template syntax', () => {
    const service = new MustacheTemplateService();
    
    expect(service.validateTemplate('<div>{{badgeName}}</div>')).toBe(true);
    expect(service.validateTemplate('<div>{{badgeName}</div>')).toBe(false);
  });
});
```

### **Component Testing**
```typescript
// src/components/__tests__/MustacheBadgePreview.test.tsx
describe('MustacheBadgePreview', () => {
  it('should render badge with template', async () => {
    render(<MustacheBadgePreview templateId="test-template" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });
  });
  
  it('should handle template errors gracefully', async () => {
    render(<MustacheBadgePreview templateId="invalid-template" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
```

## 📊 **Performance Considerations**

### **Template Caching**
- Cache compiled templates in memory
- Cache partial templates
- Implement template versioning for cache invalidation

### **Rendering Optimization**
- Use React.memo for preview component
- Debounce template re-rendering
- Optimize Mustache rendering with pre-compilation

### **Database Optimization**
- Index template lookups
- Cache frequently used templates
- Implement template compression for large templates

## 🚀 **Benefits**

### **Developer Experience**
- **Familiar Syntax**: Same as email templates
- **Easy Debugging**: Text-based templates are easy to inspect
- **Version Control**: Templates work well with Git
- **No Schema Changes**: Easy to add new template features

### **User Experience**
- **Flexible Design**: Unlimited template variations
- **Fast Rendering**: Compiled templates are performant
- **Error Handling**: Graceful fallbacks for invalid templates
- **Live Preview**: Real-time template updates

### **Maintenance**
- **Centralized Templates**: All templates in database
- **Easy Updates**: Modify templates without code changes
- **Template Reuse**: Partials can be shared across templates
- **Validation**: Built-in template syntax validation

---

**Last Updated**: January 2025  
**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: 2-3 weeks for complete implementation
