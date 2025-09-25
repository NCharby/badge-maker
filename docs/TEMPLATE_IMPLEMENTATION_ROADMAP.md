# Badge Maker - Template Implementation Roadmap

## 🎯 **Project Overview**

This roadmap outlines the step-by-step implementation plan for restoring per-event template functionality to the Badge Maker application. The plan is designed to be incremental, safe, and maintainable while preserving all existing functionality.

## 📅 **Implementation Timeline**

### **Week 1: Foundation & Core Types**
**Goal**: Establish template system foundation without breaking existing functionality

#### **Day 1-2: Template Type System**
- [ ] Create `src/types/template.ts` with comprehensive type definitions
- [ ] Define `TemplateConfig` interface with all required fields
- [ ] Create validation schemas using Zod
- [ ] Add TypeScript strict mode compliance
- [ ] Write unit tests for type definitions

#### **Day 3-4: Template Service Layer**
- [ ] Create `src/lib/template-service.ts` for template operations
- [ ] Implement template fetching from database
- [ ] Add template validation logic
- [ ] Create template caching mechanism
- [ ] Add error handling and fallbacks

#### **Day 5: Template Utilities**
- [ ] Create `src/lib/template-utils.ts` for helper functions
- [ ] Implement coordinate conversion utilities
- [ ] Add color validation and conversion
- [ ] Create font loading utilities
- [ ] Add template merging capabilities

### **Week 2: Dynamic Rendering Engine**
**Goal**: Build the core template rendering system

#### **Day 1-2: Dynamic Badge Preview Component**
- [ ] Create `src/components/organisms/DynamicBadgePreview.tsx`
- [ ] Implement template-based positioning system
- [ ] Add support for custom colors and gradients
- [ ] Implement font system integration
- [ ] Add responsive scaling logic

#### **Day 3-4: Template Rendering Features**
- [ ] Add decorative elements support (frills, borders, shadows)
- [ ] Implement image positioning and cropping
- [ ] Add text alignment and wrapping
- [ ] Create social media icon integration
- [ ] Add template validation in component

#### **Day 5: Performance & Optimization**
- [ ] Implement template caching
- [ ] Add memoization for expensive operations
- [ ] Optimize re-rendering logic
- [ ] Add performance monitoring
- [ ] Create performance benchmarks

### **Week 3: Event Integration**
**Goal**: Connect templates to the existing event system

#### **Day 1-2: Event Page Updates**
- [ ] Update `src/app/[event-name]/badge-creator/page.tsx` to load templates
- [ ] Modify `src/app/[event-name]/landing/page.tsx` for template support
- [ ] Update `src/app/[event-name]/confirmation/page.tsx` for template rendering
- [ ] Add template loading states and error handling
- [ ] Implement template fallback logic

#### **Day 3-4: BadgeCreationForm Integration**
- [ ] Update `BadgeCreationForm` to accept template config
- [ ] Modify form to use dynamic badge preview
- [ ] Add template switching logic
- [ ] Implement template validation in form
- [ ] Add template error handling

#### **Day 5: Confirmation Page Integration**
- [ ] Update confirmation page to use dynamic rendering
- [ ] Add template consistency across pages
- [ ] Implement template-based PDF generation
- [ ] Add template validation for confirmation
- [ ] Test end-to-end template flow

### **Week 4: Testing & Polish**
**Goal**: Ensure reliability and performance

#### **Day 1-2: Comprehensive Testing**
- [ ] Unit tests for all template components
- [ ] Integration tests for template loading
- [ ] Visual regression tests for template rendering
- [ ] Performance tests for template operations
- [ ] End-to-end tests for complete user flow

#### **Day 3-4: Template Examples & Documentation**
- [ ] Create additional template examples
- [ ] Add template documentation
- [ ] Create template migration guide
- [ ] Add template troubleshooting guide
- [ ] Create template best practices

#### **Day 5: Deployment & Monitoring**
- [ ] Deploy to staging environment
- [ ] Monitor performance metrics
- [ ] Test with real event data
- [ ] Deploy to production
- [ ] Monitor production metrics

## 🏗️ **Implementation Details**

### **Phase 1: Template Type System**

#### **Template Configuration Interface**
```typescript
// src/types/template.ts
export interface TemplateConfig {
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
  
  // Decorative elements
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

#### **Template Service Implementation**
```typescript
// src/lib/template-service.ts
export class TemplateService {
  private cache = new Map<string, TemplateConfig>();
  
  async getTemplateForEvent(eventSlug: string): Promise<TemplateConfig> {
    // Check cache first
    if (this.cache.has(eventSlug)) {
      return this.cache.get(eventSlug)!;
    }
    
    // Fetch from API
    const response = await fetch(`/api/events/${eventSlug}`);
    const { template } = await response.json();
    
    // Validate template
    if (!this.validateTemplateConfig(template)) {
      throw new Error('Invalid template configuration');
    }
    
    // Cache and return
    this.cache.set(eventSlug, template);
    return template;
  }
  
  validateTemplateConfig(config: TemplateConfig): boolean {
    // Comprehensive validation logic
    return true; // Simplified for example
  }
  
  getDefaultTemplate(): TemplateConfig {
    // Return hardcoded default template
    return DEFAULT_TEMPLATE_CONFIG;
  }
}
```

### **Phase 2: Dynamic Rendering Engine**

#### **Dynamic Badge Preview Component**
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
  const { data, originalImage, croppedImage } = useBadgeStore();
  const displayData = badgeData || data;
  const displayImage = imageUrl ? null : (croppedImage || originalImage);
  
  // Convert template coordinates to CSS
  const imageStyle = {
    position: 'absolute' as const,
    left: `${templateConfig.layout.imagePosition.x * 100}%`,
    top: `${templateConfig.layout.imagePosition.y * 100}%`,
    width: `${templateConfig.layout.imagePosition.width * 100}%`,
    height: `${templateConfig.layout.imagePosition.height * 100}%`,
  };
  
  const badgeNameStyle = {
    position: 'absolute' as const,
    left: `${templateConfig.layout.textPositions.badge_name.x * 100}%`,
    top: `${templateConfig.layout.textPositions.badge_name.y * 100}%`,
    width: `${templateConfig.layout.textPositions.badge_name.width * 100}%`,
    textAlign: templateConfig.layout.textPositions.badge_name.align,
    fontFamily: templateConfig.fonts.badge_name,
    color: templateConfig.colors.text,
  };
  
  return (
    <div 
      className="relative"
      style={{
        width: `${templateConfig.dimensions.width * 100}px`,
        height: `${templateConfig.dimensions.height * 100}px`,
        background: templateConfig.colors.gradient 
          ? `linear-gradient(${templateConfig.colors.gradient.direction}, ${templateConfig.colors.gradient.from}, ${templateConfig.colors.gradient.to})`
          : templateConfig.colors.background,
        borderRadius: templateConfig.decorations?.borders?.radius || 0,
        boxShadow: templateConfig.decorations?.shadows ? '0 4px 8px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {/* Image */}
      {displayImage && (
        <img 
          src={displayImage} 
          alt="Badge photo"
          style={imageStyle}
          className="object-cover rounded-full"
        />
      )}
      
      {/* Badge Name */}
      <div style={badgeNameStyle}>
        {displayData?.badge_name || 'Badge Name'}
      </div>
      
      {/* Email */}
      <div style={{
        position: 'absolute',
        left: `${templateConfig.layout.textPositions.email.x * 100}%`,
        top: `${templateConfig.layout.textPositions.email.y * 100}%`,
        width: `${templateConfig.layout.textPositions.email.width * 100}%`,
        textAlign: templateConfig.layout.textPositions.email.align,
        fontFamily: templateConfig.fonts.email,
        color: templateConfig.colors.text,
      }}>
        {displayData?.email || 'email@example.com'}
      </div>
      
      {/* Social Media */}
      <div style={{
        position: 'absolute',
        left: `${templateConfig.layout.textPositions.social_media.x * 100}%`,
        top: `${templateConfig.layout.textPositions.social_media.y * 100}%`,
        width: `${templateConfig.layout.textPositions.social_media.width * 100}%`,
        textAlign: templateConfig.layout.textPositions.social_media.align,
        fontFamily: templateConfig.fonts.social_media,
        color: templateConfig.colors.text,
      }}>
        {displayData?.social_media_handles?.map((handle, index) => (
          <div key={index}>
            {handle.platform}: {handle.handle}
          </div>
        ))}
      </div>
      
      {/* Decorative Elements */}
      {templateConfig.decorations?.frills && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <img src="/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg" className="absolute top-0 left-0" />
          <img src="/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg" className="absolute top-0 right-0" />
        </div>
      )}
    </div>
  );
}
```

### **Phase 3: Event Integration**

#### **Updated Event Page**
```typescript
// src/app/[event-name]/badge-creator/page.tsx
export default async function EventBadgeCreatorPage({ params }: EventBadgeCreatorPageProps) {
  const eventSlug = params['event-name'];
  
  // Fetch event data with template
  const eventData = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/${eventSlug}`);
  const { event, template } = await eventData.json();
  
  if (!event) {
    notFound();
  }
  
  return (
    <div className="min-h-screen bg-[#111111]">
      <div className="container mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-montserrat">
            BADGE-O-MATIC
          </h1>
          <div className="text-xl text-gray-300 mb-4 font-open-sans">
            {event.name} - Badge Creator
          </div>
        </div>

        {/* Badge Creation Form with Template */}
        <div className="max-w-4xl mx-auto">
          <BadgeCreationForm 
            eventSlug={eventSlug} 
            templateConfig={template} 
          />
        </div>
      </div>
    </div>
  );
}
```

#### **Updated BadgeCreationForm**
```typescript
// src/components/organisms/BadgeCreationForm.tsx
interface BadgeCreationFormProps {
  eventSlug: string;
  templateConfig: TemplateConfig;
}

export function BadgeCreationForm({ eventSlug, templateConfig }: BadgeCreationFormProps) {
  // ... existing form logic ...
  
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 max-w-7xl">
      {/* Form Sections */}
      <div className="space-y-6">
        {/* BASICS Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          {/* ... existing form content ... */}
        </Card>
        
        {/* PHOTO Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          {/* ... existing photo upload content ... */}
        </Card>
        
        {/* SOCIALS Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          {/* ... existing social media content ... */}
        </Card>
      </div>
      
      {/* Badge Preview with Template */}
      <div className="flex justify-center items-center min-h-[600px]">
        <DynamicBadgePreview templateConfig={templateConfig} />
      </div>
    </div>
  );
}
```

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
// src/lib/__tests__/template-service.test.ts
describe('TemplateService', () => {
  it('should fetch template for event', async () => {
    const service = new TemplateService();
    const template = await service.getTemplateForEvent('test-event');
    expect(template).toBeDefined();
    expect(template.dimensions).toBeDefined();
  });
  
  it('should validate template configuration', () => {
    const service = new TemplateService();
    const validTemplate = getValidTemplateConfig();
    const invalidTemplate = getInvalidTemplateConfig();
    
    expect(service.validateTemplateConfig(validTemplate)).toBe(true);
    expect(service.validateTemplateConfig(invalidTemplate)).toBe(false);
  });
});
```

### **Integration Tests**
```typescript
// src/components/__tests__/DynamicBadgePreview.test.tsx
describe('DynamicBadgePreview', () => {
  it('should render badge with template configuration', () => {
    const templateConfig = getTestTemplateConfig();
    const badgeData = getTestBadgeData();
    
    render(<DynamicBadgePreview templateConfig={templateConfig} badgeData={badgeData} />);
    
    expect(screen.getByText(badgeData.badge_name)).toBeInTheDocument();
    expect(screen.getByText(badgeData.email)).toBeInTheDocument();
  });
  
  it('should fallback to default template on error', () => {
    const invalidTemplate = getInvalidTemplateConfig();
    
    render(<DynamicBadgePreview templateConfig={invalidTemplate} />);
    
    // Should render with default template
    expect(screen.getByText('Badge Name')).toBeInTheDocument();
  });
});
```

### **Visual Regression Tests**
```typescript
// src/components/__tests__/template-visual.test.tsx
describe('Template Visual Tests', () => {
  it('should match default template snapshot', () => {
    const templateConfig = getDefaultTemplateConfig();
    const { container } = render(<DynamicBadgePreview templateConfig={templateConfig} />);
    expect(container.firstChild).toMatchSnapshot();
  });
  
  it('should match custom template snapshot', () => {
    const templateConfig = getCustomTemplateConfig();
    const { container } = render(<DynamicBadgePreview templateConfig={templateConfig} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

## 📊 **Performance Monitoring**

### **Key Metrics to Track**
- Template loading time
- Badge rendering time
- Memory usage
- Cache hit rate
- Error rate

### **Performance Targets**
- Template loading: < 200ms
- Badge rendering: < 100ms
- Memory usage: < 50MB
- Cache hit rate: > 80%
- Error rate: < 1%

### **Monitoring Implementation**
```typescript
// src/lib/performance-monitor.ts
export class PerformanceMonitor {
  static trackTemplateLoad(eventSlug: string, duration: number) {
    // Track template loading performance
    console.log(`Template load for ${eventSlug}: ${duration}ms`);
  }
  
  static trackBadgeRender(templateId: string, duration: number) {
    // Track badge rendering performance
    console.log(`Badge render for ${templateId}: ${duration}ms`);
  }
}
```

## 🚀 **Deployment Strategy**

### **Staging Deployment**
1. Deploy to staging environment
2. Test with real event data
3. Monitor performance metrics
4. Validate all functionality
5. Get stakeholder approval

### **Production Deployment**
1. Deploy to production with feature flag
2. Enable for test events first
3. Monitor production metrics
4. Gradually enable for all events
5. Remove feature flag after validation

### **Rollback Plan**
1. Keep hardcoded implementation as fallback
2. Implement feature flag for quick disable
3. Monitor error rates and performance
4. Have rollback procedure ready
5. Test rollback procedure

## 📋 **Success Criteria**

### **Technical Success**
- [ ] Templates load from database successfully
- [ ] Dynamic rendering works correctly
- [ ] Performance within 10% of current implementation
- [ ] All existing functionality preserved
- [ ] Zero template-related errors in production

### **User Experience Success**
- [ ] Different events can have different badge designs
- [ ] Template switching is seamless
- [ ] Badge preview updates in real-time
- [ ] Mobile responsiveness maintained
- [ ] Accessibility standards met

### **Business Success**
- [ ] Event organizers can customize badge designs
- [ ] Reduced support requests for badge customization
- [ ] Faster event setup with reusable templates
- [ ] Higher badge creation completion rates

## 🔍 **Risk Mitigation**

### **Technical Risks**
- **Template Rendering Complexity**: Use proven CSS/JS patterns
- **Performance Impact**: Implement caching and optimization
- **Browser Compatibility**: Test across all target browsers
- **Data Migration**: Ensure existing data remains compatible

### **User Experience Risks**
- **Template Loading Delays**: Implement loading states
- **Template Errors**: Provide clear error messages and fallbacks
- **Design Inconsistency**: Maintain design system standards
- **Mobile Issues**: Ensure responsive design works with templates

### **Business Risks**
- **Feature Complexity**: Keep initial implementation simple
- **Support Burden**: Provide comprehensive documentation
- **Performance Issues**: Monitor and optimize continuously
- **User Adoption**: Provide clear benefits and examples

---

**Last Updated**: January 2025  
**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: 4 weeks for complete implementation
