# Badge Maker - Incremental Implementation Plan

## 🎯 **Overview**

This document outlines a step-by-step implementation plan for transitioning from hardcoded badge design to Mustache templates. Each step is designed to be testable and verifiable before proceeding to the next.

## 📋 **Implementation Steps**

### **Step 1: Database Migration (Testable)**
**Goal**: Migrate database schema and create COG Classic template
**Duration**: 30 minutes
**Testing**: Verify database changes and template creation

#### **1.1: Backup and Schema Update**
```sql
-- Create backup
CREATE TABLE public.templates_backup AS SELECT * FROM public.templates;

-- Add new columns
ALTER TABLE public.templates 
ADD COLUMN template_type TEXT DEFAULT 'badge' CHECK (template_type IN ('badge', 'email', 'pdf'));

ALTER TABLE public.templates 
ADD COLUMN version TEXT DEFAULT '1.0.0';
```

#### **1.2: Create COG Classic Template**
```sql
-- Insert COG Classic template
INSERT INTO public.templates (id, name, description, config, template_type, version) VALUES
(
  'cog-classic-2026',
  'COG Classic 2026',
  'COG Classic badge template with decorative frills and gradient background',
  '<div class="badge-container" style="width: 284px; height: 400px; background: linear-gradient(to bottom, #0f2733, #170a2a); border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}{{> badge-content }}</div>',
  'badge',
  '1.0.0'
);
```

#### **1.3: Update Event References**
```sql
-- Update COG Classic 2026 event
UPDATE public.events 
SET template_id = 'cog-classic-2026'
WHERE slug = 'cog-classic-2026';
```

#### **Testing Step 1**
- [ ] Run SQL commands successfully
- [ ] Verify template created in database
- [ ] Verify event linked to template
- [ ] Check API still returns template data

---

### **Step 2: Install Mustache Dependencies (Testable)**
**Goal**: Add Mustache.js to the project
**Duration**: 5 minutes
**Testing**: Verify package installation

#### **2.1: Install Mustache.js**
```bash
npm install mustache
npm install @types/mustache --save-dev
```

#### **Testing Step 2**
- [ ] Package installed successfully
- [ ] No TypeScript errors
- [ ] Application still builds

---

### **Step 3: Create Template Service (Testable)**
**Goal**: Build Mustache template rendering service
**Duration**: 45 minutes
**Testing**: Unit tests for template rendering

#### **3.1: Create Template Service**
```typescript
// src/lib/template-service.ts
import mustache from 'mustache';

export interface TemplateData {
  badgeName: string;
  imageUrl?: string;
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
    iconUrl: string;
  }>;
  decorations: {
    frills: {
      left: boolean;
      right: boolean;
      lower: boolean;
    };
  };
}

export class TemplateService {
  static renderTemplate(template: string, data: TemplateData): string {
    return mustache.render(template, data);
  }
}
```

#### **3.2: Create Template Partials**
```typescript
// src/lib/template-partials.ts
export const templatePartials = {
  'frill-elements': `
    {{#frills.left}}
    <div class="frill-left" style="position: absolute; top: 0; left: 0; width: 100px; height: 100px;">
      <img src="/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg" alt="Left frill" style="width: 100%; height: 100%;" />
    </div>
    {{/frills.left}}
    {{#frills.right}}
    <div class="frill-right" style="position: absolute; top: 0; right: 0; width: 100px; height: 100px;">
      <img src="/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg" alt="Right frill" style="width: 100%; height: 100%;" />
    </div>
    {{/frills.right}}
    {{#frills.lower}}
    <div class="frill-lower" style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 173.873px; height: 57.019px;">
      <img src="/assets/2c6cb173ab669ace01ece5b59fa70abcc55efcec.svg" alt="Lower frill" style="width: 100%; height: 100%;" />
    </div>
    {{/frills.lower}}
  `,
  'badge-content': `
    <div class="badge-content" style="position: relative; z-index: 10; padding: 15px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div class="profile-image-container" style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-bottom: 20px; background: #333;">
        {{#imageUrl}}
          <img src="{{imageUrl}}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" />
        {{/imageUrl}}
        {{^imageUrl}}
          <img src="/assets/question-placer@2x.png" alt="Question mark placeholder" style="width: 32px; height: 32px; object-contain; margin: 24px;" />
        {{/imageUrl}}
      </div>
      <div class="badge-name" style="text-align: center; margin-bottom: 20px;">
        <h2 style="font-family: 'Montserrat', sans-serif; font-size: 24px; color: white; margin: 0; line-height: 1.2; word-break: break-word;">
          {{badgeName}}
        </h2>
      </div>
      {{#socialMediaHandles}}
        {{#platform}}
          {{^none}}
            <div class="social-handle" style="display: flex; align-items: center; gap: 10px; margin: 5px 0; padding: 5px 20px;">
              <div class="social-icon" style="width: 24px; height: 24px;">
                <img src="{{iconUrl}}" alt="{{platform}} icon" style="width: 100%; height: 100%;" />
              </div>
              <span style="font-family: 'Montserrat', sans-serif; font-size: 14px; color: white;">
                {{handle}}
              </span>
            </div>
          {{/none}}
        {{/platform}}
      {{/socialMediaHandles}}
    </div>
  `
};
```

#### **Testing Step 3**
- [ ] Template service compiles without errors
- [ ] Unit tests pass for template rendering
- [ ] Partials render correctly with test data
- [ ] No breaking changes to existing code

---

### **Step 4: Create Test Page (Testable)**
**Goal**: Build a test page to verify Mustache rendering
**Duration**: 30 minutes
**Testing**: Visual verification of rendered template

#### **4.1: Create Template Test Page**
```typescript
// src/app/test-template/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { TemplateService, TemplateData } from '@/lib/template-service';
import { templatePartials } from '@/lib/template-partials';

export default function TestTemplatePage() {
  const [renderedTemplate, setRenderedTemplate] = useState<string>('');
  const [template, setTemplate] = useState<string>('');

  const testData: TemplateData = {
    badgeName: 'Test Badge',
    imageUrl: '/assets/question-placer@2x.png',
    socialMediaHandles: [
      { platform: 'x', handle: '@testuser', iconUrl: '/assets/social-icons/x-icon-white.svg' },
      { platform: 'discord', handle: 'testuser#1234', iconUrl: '/assets/social-icons/discord-icon-white.svg' }
    ],
    decorations: {
      frills: { left: true, right: true, lower: true }
    }
  };

  useEffect(() => {
    // Fetch COG Classic template from API
    fetch('/api/templates/cog-classic-2026')
      .then(res => res.json())
      .then(data => {
        setTemplate(data.template);
        const rendered = TemplateService.renderTemplate(data.template, testData);
        setRenderedTemplate(rendered);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Template Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-2">Rendered Template</h2>
          <div 
            className="border p-4 bg-gray-100"
            dangerouslySetInnerHTML={{ __html: renderedTemplate }}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Template Source</h2>
          <pre className="bg-gray-100 p-4 text-sm overflow-auto">
            {template}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

#### **4.2: Create Template API Endpoint**
```typescript
// src/app/api/templates/[templateId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const supabase = createClient();
  const { templateId } = params;

  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template: template.config });
}
```

#### **Testing Step 4**
- [ ] Test page loads without errors
- [ ] Template API returns correct data
- [ ] Mustache rendering works
- [ ] Visual output matches expected design
- [ ] All decorative elements display correctly

---

### **Step 5: Create MustacheBadgePreview Component (Testable)**
**Goal**: Build new component that uses Mustache templates
**Duration**: 60 minutes
**Testing**: Side-by-side comparison with current component

#### **5.1: Create MustacheBadgePreview Component**
```typescript
// src/components/organisms/MustacheBadgePreview.tsx
'use client';

import { useEffect, useState } from 'react';
import { TemplateService, TemplateData } from '@/lib/template-service';
import { templatePartials } from '@/lib/template-partials';
import { getPlatformIcon } from '@/lib/badge-assets';

interface MustacheBadgePreviewProps {
  badgeData?: {
    badge_name?: string;
    social_media_handles?: Array<{
      platform: string;
      handle: string;
    }>;
  };
  imageUrl?: string;
  templateId?: string;
}

export function MustacheBadgePreview({ 
  badgeData, 
  imageUrl, 
  templateId = 'cog-classic-2026' 
}: MustacheBadgePreviewProps) {
  const [renderedTemplate, setRenderedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderTemplate = async () => {
      try {
        // Fetch template from API
        const response = await fetch(`/api/templates/${templateId}`);
        const { template } = await response.json();

        // Prepare template data
        const templateData: TemplateData = {
          badgeName: badgeData?.badge_name || 'BADGE NAME',
          imageUrl: imageUrl,
          socialMediaHandles: (badgeData?.social_media_handles || []).map(handle => ({
            platform: handle.platform,
            handle: handle.handle,
            iconUrl: getPlatformIcon(handle.platform) || ''
          })),
          decorations: {
            frills: { left: true, right: true, lower: true }
          }
        };

        // Render template
        const rendered = TemplateService.renderTemplate(template, templateData);
        setRenderedTemplate(rendered);
      } catch (error) {
        console.error('Error rendering template:', error);
      } finally {
        setLoading(false);
      }
    };

    renderTemplate();
  }, [badgeData, imageUrl, templateId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[600px]">
        <div className="text-white">Loading template...</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[600px] sm:min-h-[500px] md:min-h-[600px]">
      <div 
        className="badge-preview-container"
        dangerouslySetInnerHTML={{ __html: renderedTemplate }}
      />
    </div>
  );
}
```

#### **Testing Step 5**
- [ ] Component renders without errors
- [ ] Template data is processed correctly
- [ ] Visual output is ready for design review
- [ ] Responsive scaling works
- [ ] All interactive elements function
- [ ] **Designer Review**: Layout ready for your review and corrections

---

### **Step 6: Update BadgeCreationForm (Testable)**
**Goal**: Replace BadgePreview with MustacheBadgePreview
**Duration**: 15 minutes
**Testing**: Verify form still works with new component

#### **6.1: Update BadgeCreationForm**
```typescript
// src/components/organisms/BadgeCreationForm.tsx
// Replace import
import { MustacheBadgePreview } from '@/components/organisms/MustacheBadgePreview';

// Replace BadgePreview usage
<MustacheBadgePreview 
  badgeData={displayData} 
  imageUrl={displayImage ? URL.createObjectURL(displayImage) : undefined}
  templateId="cog-classic-2026"
/>
```

#### **Testing Step 6**
- [ ] Form loads without errors
- [ ] Badge preview updates in real-time
- [ ] All form functionality preserved
- [ ] No breaking changes to user experience

---

### **Step 7: Update ConfirmationPage (Testable)**
**Goal**: Replace BadgePreview with MustacheBadgePreview in confirmation
**Duration**: 15 minutes
**Testing**: Verify confirmation page works with new component

#### **7.1: Update ConfirmationPage**
```typescript
// src/components/pages/ConfirmationPage.tsx
// Replace import
import { MustacheBadgePreview } from '@/components/organisms/MustacheBadgePreview';

// Replace BadgePreview usage
<MustacheBadgePreview 
  badgeData={badgeData} 
  imageUrl={badgeData?.image_url}
  templateId="cog-classic-2026"
/>
```

#### **Testing Step 7**
- [ ] Confirmation page loads without errors
- [ ] Badge displays correctly
- [ ] PDF generation still works
- [ ] Email functionality preserved

---

### **Step 8: Final Testing and Cleanup (Testable)**
**Goal**: Comprehensive testing and cleanup
**Duration**: 30 minutes
**Testing**: Full application testing

#### **8.1: Comprehensive Testing**
- [ ] All pages load without errors
- [ ] Badge creation flow works end-to-end
- [ ] PDF generation works with new template
- [ ] Email system works with new template
- [ ] All existing functionality preserved
- [ ] Performance is acceptable

#### **8.2: Cleanup**
- [ ] Remove old BadgePreview component
- [ ] Remove test pages (except test-template for future use)
- [ ] Update documentation
- [ ] Clean up unused imports

#### **Testing Step 8**
- [ ] Full application testing passes
- [ ] No broken functionality
- [ ] Clean codebase
- [ ] Documentation updated

---

## 🎯 **Success Criteria**

### **Technical Success**
- ✅ Mustache templates render correctly
- ✅ All visual elements preserved
- ✅ Performance maintained or improved
- ✅ No breaking changes to existing functionality

### **User Experience Success**
- ✅ Badge creation flow unchanged
- ✅ Visual output identical to current design
- ✅ All features work as expected
- ✅ No user-facing errors

### **Maintainability Success**
- ✅ Template system is flexible and extensible
- ✅ Code is clean and well-documented
- ✅ Future template changes are easy to implement
- ✅ Database schema supports multiple templates

## 📊 **Testing Strategy**

### **Automated Testing**
- Unit tests for template service
- Component tests for MustacheBadgePreview
- API tests for template endpoints

### **Manual Testing**
- Visual comparison of old vs new components
- End-to-end user flow testing
- Cross-browser compatibility testing
- Performance testing

### **User Acceptance Testing**
- Verify badge creation flow works
- Confirm visual output matches expectations
- Test PDF generation and email functionality
- Validate all existing features work

## 🚀 **Deployment Strategy**

### **Staging Deployment**
1. Deploy to staging environment
2. Run comprehensive tests
3. Verify all functionality works
4. Get user approval

### **Production Deployment**
1. Deploy during low-traffic period
2. Monitor for errors
3. Have rollback plan ready
4. Verify all systems working

### **Rollback Plan**
1. Revert to previous version
2. Restore old BadgePreview component
3. Verify application works
4. Investigate and fix issues

## 📝 **Notes**

- Each step is designed to be completed and tested independently
- No step should break existing functionality
- All changes are backward compatible
- Template system is designed for future extensibility
- COG Classic design is preserved exactly as-is
