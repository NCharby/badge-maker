# Badge Maker - Template System Restoration Plan

## 🎯 **Project Overview**

This document outlines the plan to restore per-event template functionality to the Badge Maker application. The system previously supported dynamic badge templates but was temporarily replaced with a hardcoded implementation to avoid bugs during launch. We now want to restore the flexible template system while maintaining the current design quality.

## 📊 **Current State Analysis**

### **Database Infrastructure (✅ Ready)**
The database schema is already properly set up for template functionality:

```sql
-- Templates table with JSONB config
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,  -- Template configuration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table with template reference
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  template_id TEXT REFERENCES public.templates(id), -- ✅ Already linked
  -- ... other fields
);
```

### **Current Template Configuration**
The database contains a default template with the following structure:

```json
{
  "dimensions": {"width": 3.5, "height": 2.25},
  "layout": {
    "imagePosition": {"x": 0.25, "y": 0.5, "width": 0.4, "height": 0.4, "aspectRatio": 1},
    "textPositions": {
      "badge_name": {"x": 0.7, "y": 0.3, "width": 0.25, "align": "left"},
      "email": {"x": 0.7, "y": 0.5, "width": 0.25, "align": "left"},
      "social_media": {"x": 0.7, "y": 0.7, "width": 0.25, "align": "left"}
    },
    "fonts": {
      "badge_name": "Inter",
      "email": "Inter", 
      "social_media": "Inter"
    },
    "colors": {
      "background": "#ffffff",
      "text": "#1f2937",
      "accent": "#3b82f6"
    }
  },
  "imageRequirements": {
    "aspectRatio": 1,
    "minWidth": 300,
    "minHeight": 300,
    "format": "square"
  }
}
```

### **API Infrastructure (✅ Ready)**
The event API already fetches template data:

```typescript
// src/app/api/events/[slug]/route.ts
const { data: template, error: templateError } = await supabase
  .from('templates')
  .select('*')
  .eq('id', event.template_id)
  .single();

return NextResponse.json({
  event: { /* event data */ },
  template: template?.config || null, // ✅ Template config returned
});
```

### **Current Hardcoded Implementation**
The `BadgePreview.tsx` component currently uses hardcoded Figma design:

```typescript
// Current hardcoded implementation
export function BadgePreview({ badgeData, imageUrl }: BadgePreviewProps = {}) {
  return (
    <div className="bg-gradient-to-b from-[#0f2733] to-[#170a2a] rounded-[10px] w-[284px] h-[400px]">
      {/* Hardcoded Figma design elements */}
    </div>
  );
}
```

## 🎨 **Template System Architecture**

### **Template Configuration Schema**
```typescript
interface TemplateConfig {
  // Visual dimensions
  dimensions: {
    width: number;  // inches
    height: number; // inches
  };
  
  // Layout positioning (relative coordinates 0-1)
  layout: {
    imagePosition: {
      x: number;
      y: number;
      width: number;
      height: number;
      aspectRatio: number;
    };
    textPositions: {
      badge_name: { x: number; y: number; width: number; align: 'left' | 'center' | 'right' };
      email: { x: number; y: number; width: number; align: 'left' | 'center' | 'right' };
      social_media: { x: number; y: number; width: number; align: 'left' | 'center' | 'right' };
    };
  };
  
  // Typography
  fonts: {
    badge_name: string;
    email: string;
    social_media: string;
  };
  
  // Color scheme
  colors: {
    background: string;
    text: string;
    accent: string;
    gradient?: {
      from: string;
      to: string;
      direction: 'vertical' | 'horizontal' | 'diagonal';
    };
  };
  
  // Image requirements
  imageRequirements: {
    aspectRatio: number;
    minWidth: number;
    minHeight: number;
    format: 'square' | 'portrait' | 'landscape';
  };
  
  // Decorative elements (optional)
  decorations?: {
    frills?: boolean;
    borders?: {
      radius: number;
      color?: string;
      width?: number;
    };
    shadows?: boolean;
  };
}
```

### **Template Rendering Engine**
```typescript
interface TemplateRenderer {
  renderBadge(config: TemplateConfig, data: BadgeData): JSX.Element;
  validateConfig(config: TemplateConfig): boolean;
  getDefaultConfig(): TemplateConfig;
}
```

## 🔄 **Implementation Plan**

### **Phase 1: Template System Foundation**

#### **1.1 Create Template Types**
```typescript
// src/types/template.ts
export interface TemplateConfig {
  dimensions: TemplateDimensions;
  layout: TemplateLayout;
  fonts: TemplateFonts;
  colors: TemplateColors;
  imageRequirements: ImageRequirements;
  decorations?: TemplateDecorations;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  config: TemplateConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### **1.2 Create Template Service**
```typescript
// src/lib/template-service.ts
export class TemplateService {
  async getTemplateForEvent(eventSlug: string): Promise<TemplateConfig>;
  async validateTemplateConfig(config: TemplateConfig): Promise<boolean>;
  async getDefaultTemplate(): Promise<TemplateConfig>;
  renderBadge(config: TemplateConfig, data: BadgeData): JSX.Element;
}
```

#### **1.3 Update Event Data Types**
```typescript
// src/types/event.ts - Update existing interface
export interface EventData {
  event: Event;
  template: TemplateConfig; // Change from 'any' to proper type
}
```

### **Phase 2: Template Rendering Engine**

#### **2.1 Create Dynamic BadgePreview Component**
```typescript
// src/components/organisms/DynamicBadgePreview.tsx
interface DynamicBadgePreviewProps {
  badgeData?: BadgeData;
  imageUrl?: string;
  templateConfig: TemplateConfig;
}

export function DynamicBadgePreview({ 
  badgeData, 
  imageUrl, 
  templateConfig 
}: DynamicBadgePreviewProps) {
  // Render badge based on template configuration
  // Support for:
  // - Dynamic positioning
  // - Custom colors and gradients
  // - Font variations
  // - Decorative elements
  // - Responsive scaling
}
```

#### **2.2 Template Configuration Validation**
```typescript
// src/lib/template-validator.ts
export function validateTemplateConfig(config: TemplateConfig): ValidationResult {
  // Validate:
  // - Required fields
  // - Coordinate ranges (0-1)
  // - Color format validity
  // - Font availability
  // - Dimension constraints
}
```

### **Phase 3: Event Integration**

#### **3.1 Update Event Loading**
```typescript
// Update existing event pages to load template data
export default async function EventBadgeCreatorPage({ params }: EventBadgeCreatorPageProps) {
  const eventSlug = params['event-name'];
  
  // Fetch event with template
  const eventData = await fetch(`/api/events/${eventSlug}`);
  const { event, template } = await eventData.json();
  
  return (
    <BadgeCreationForm 
      eventSlug={eventSlug} 
      templateConfig={template} // Pass template to form
    />
  );
}
```

#### **3.2 Update BadgeCreationForm**
```typescript
// src/components/organisms/BadgeCreationForm.tsx
interface BadgeCreationFormProps {
  eventSlug: string;
  templateConfig: TemplateConfig; // Add template prop
}

export function BadgeCreationForm({ eventSlug, templateConfig }: BadgeCreationFormProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
      <div>
        {/* Form sections */}
      </div>
      <div>
        <DynamicBadgePreview templateConfig={templateConfig} />
      </div>
    </div>
  );
}
```

### **Phase 4: Template Management**

#### **4.1 Template CRUD API**
```typescript
// src/app/api/templates/route.ts
export async function GET() {
  // List all templates
}

export async function POST(request: NextRequest) {
  // Create new template
}

// src/app/api/templates/[id]/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Get specific template
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // Update template
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // Delete template
}
```

#### **4.2 Template Admin Interface (Future)**
```typescript
// src/components/admin/TemplateEditor.tsx
export function TemplateEditor() {
  // Visual template editor
  // Drag-and-drop positioning
  // Color picker
  // Font selection
  // Live preview
}
```

## 🎨 **Template Examples**

### **Default Template (Current Figma Design)**
```json
{
  "dimensions": {"width": 3.5, "height": 2.25},
  "layout": {
    "imagePosition": {"x": 0.25, "y": 0.5, "width": 0.4, "height": 0.4, "aspectRatio": 1},
    "textPositions": {
      "badge_name": {"x": 0.7, "y": 0.3, "width": 0.25, "align": "left"},
      "email": {"x": 0.7, "y": 0.5, "width": 0.25, "align": "left"},
      "social_media": {"x": 0.7, "y": 0.7, "width": 0.25, "align": "left"}
    }
  },
  "fonts": {
    "badge_name": "Montserrat",
    "email": "Open Sans",
    "social_media": "Open Sans"
  },
  "colors": {
    "background": "#ffffff",
    "text": "#ffffff",
    "accent": "#ffcc00",
    "gradient": {
      "from": "#0f2733",
      "to": "#170a2a",
      "direction": "vertical"
    }
  },
  "decorations": {
    "frills": true,
    "borders": {"radius": 10},
    "shadows": true
  }
}
```

### **Minimal Template**
```json
{
  "dimensions": {"width": 3.5, "height": 2.25},
  "layout": {
    "imagePosition": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.6, "aspectRatio": 1},
    "textPositions": {
      "badge_name": {"x": 0.5, "y": 0.3, "width": 0.4, "align": "left"},
      "email": {"x": 0.5, "y": 0.5, "width": 0.4, "align": "left"},
      "social_media": {"x": 0.5, "y": 0.7, "width": 0.4, "align": "left"}
    }
  },
  "fonts": {
    "badge_name": "Arial",
    "email": "Arial",
    "social_media": "Arial"
  },
  "colors": {
    "background": "#ffffff",
    "text": "#000000",
    "accent": "#0066cc"
  },
  "decorations": {
    "frills": false,
    "borders": {"radius": 5},
    "shadows": false
  }
}
```

### **Corporate Template**
```json
{
  "dimensions": {"width": 3.5, "height": 2.25},
  "layout": {
    "imagePosition": {"x": 0.05, "y": 0.1, "width": 0.25, "height": 0.8, "aspectRatio": 1},
    "textPositions": {
      "badge_name": {"x": 0.35, "y": 0.2, "width": 0.6, "align": "center"},
      "email": {"x": 0.35, "y": 0.4, "width": 0.6, "align": "center"},
      "social_media": {"x": 0.35, "y": 0.6, "width": 0.6, "align": "center"}
    }
  },
  "fonts": {
    "badge_name": "Helvetica",
    "email": "Helvetica",
    "social_media": "Helvetica"
  },
  "colors": {
    "background": "#f8f9fa",
    "text": "#212529",
    "accent": "#007bff",
    "gradient": {
      "from": "#ffffff",
      "to": "#f8f9fa",
      "direction": "horizontal"
    }
  },
  "decorations": {
    "frills": false,
    "borders": {"radius": 0, "color": "#dee2e6", "width": 2},
    "shadows": true
  }
}
```

## 🔧 **Migration Strategy**

### **Backward Compatibility**
1. **Keep Current Implementation**: Maintain `BadgePreview.tsx` as fallback
2. **Gradual Migration**: Introduce `DynamicBadgePreview.tsx` alongside existing component
3. **Template Detection**: Auto-detect if template config is available
4. **Fallback Logic**: Use hardcoded design if template is missing or invalid

### **Migration Steps**
1. **Phase 1**: Create template system infrastructure (no UI changes)
2. **Phase 2**: Implement dynamic rendering engine
3. **Phase 3**: Update event pages to load templates
4. **Phase 4**: Add template management features
5. **Phase 5**: Create additional template examples
6. **Phase 6**: Build admin interface for template creation

### **Testing Strategy**
1. **Unit Tests**: Template validation and rendering logic
2. **Integration Tests**: Event loading with template data
3. **Visual Tests**: Compare hardcoded vs dynamic rendering
4. **Performance Tests**: Template loading and rendering speed
5. **User Acceptance Tests**: Template switching and customization

## 📋 **Implementation Checklist**

### **Phase 1: Foundation**
- [ ] Create `src/types/template.ts` with template interfaces
- [ ] Create `src/lib/template-service.ts` for template operations
- [ ] Update `src/types/event.ts` to use proper template types
- [ ] Add template validation utilities

### **Phase 2: Rendering Engine**
- [ ] Create `src/components/organisms/DynamicBadgePreview.tsx`
- [ ] Implement template-based positioning system
- [ ] Add support for custom colors and gradients
- [ ] Implement font system integration
- [ ] Add decorative elements support

### **Phase 3: Event Integration**
- [ ] Update event pages to fetch template data
- [ ] Modify `BadgeCreationForm` to accept template config
- [ ] Update confirmation page to use dynamic rendering
- [ ] Add template loading states and error handling

### **Phase 4: Template Management**
- [ ] Create template CRUD API endpoints
- [ ] Add template validation middleware
- [ ] Create template management utilities
- [ ] Add template import/export functionality

### **Phase 5: Additional Templates**
- [ ] Create minimal template example
- [ ] Create corporate template example
- [ ] Create creative template example
- [ ] Add template preview system

### **Phase 6: Admin Interface (Future)**
- [ ] Create template editor component
- [ ] Add drag-and-drop positioning
- [ ] Implement color picker integration
- [ ] Add live preview functionality

## 🚀 **Benefits of Template System**

### **For Event Organizers**
- **Brand Consistency**: Custom templates for each event
- **Flexibility**: Easy template switching and customization
- **Professional Appearance**: Consistent, high-quality badge designs
- **Time Savings**: Reusable templates across events

### **For Developers**
- **Maintainability**: Centralized template management
- **Extensibility**: Easy to add new template features
- **Performance**: Optimized rendering with caching
- **Scalability**: Support for unlimited templates

### **For Users**
- **Variety**: Different badge styles for different events
- **Quality**: Professional, consistent designs
- **Compatibility**: Works across all devices and browsers
- **Reliability**: Robust fallback system

## 🔍 **Risk Assessment**

### **Low Risk**
- Database schema already supports templates
- API infrastructure already fetches template data
- Current hardcoded implementation can serve as fallback

### **Medium Risk**
- Template rendering complexity
- Performance impact of dynamic rendering
- Cross-browser compatibility for advanced features

### **Mitigation Strategies**
- Comprehensive testing of template rendering
- Performance monitoring and optimization
- Progressive enhancement approach
- Fallback to hardcoded design if needed

## 📈 **Success Metrics**

### **Technical Metrics**
- Template loading time < 200ms
- Rendering performance within 10% of hardcoded version
- Zero template-related errors in production
- 100% backward compatibility maintained

### **User Experience Metrics**
- Template switching time < 1 second
- Visual consistency across all templates
- Mobile responsiveness maintained
- Accessibility standards met

### **Business Metrics**
- Increased event organizer satisfaction
- Reduced support requests for badge customization
- Faster event setup time
- Higher badge creation completion rates

---

**Last Updated**: January 2025  
**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: 2-3 weeks for full implementation
