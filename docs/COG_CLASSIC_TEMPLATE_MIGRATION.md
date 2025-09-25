# COG Classic Template Migration Guide

## 🎯 **Overview**

This document outlines the migration of the current hardcoded COG Classic badge design to a Mustache template system. The current design in `BadgePreview.tsx` will be preserved as the `cog-classic-2026` template.

## 📋 **Current COG Classic Design**

### **Design Specifications**
- **Dimensions**: 284x400px (responsive scaling)
- **Background**: Dark gradient (from #0f2733 to #170a2a)
- **Border Radius**: 10px
- **Typography**: Montserrat font family
- **Text Color**: White
- **Layout**: Vertical with decorative frills

### **Key Elements**
1. **Decorative Frills**: Left, right, and lower decorative elements
2. **Profile Image**: Circular with responsive sizing
3. **Badge Name**: Centered, white text with character limit
4. **Social Media**: Maximum 2 handles with platform icons
5. **Lower Decoration**: Bottom decorative element

### **Asset References**
```typescript
// Current hardcoded asset paths
const imgFrillLeft = "/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg";
const imgFrillRight = "/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg";
const imgGroup1 = "/assets/2c6cb173ab669ace01ece5b59fa70abcc55efcec.svg";
const imgVector = "/assets/b781d68fabc1456063513abebee66dde467f5846.svg";
const imgVector1 = "/assets/1efc31fed812b9e092a380850264248ce3a30d63.svg";
```

## 🔄 **Migration Process**

### **Step 1: Create COG Classic Template**
```sql
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

### **Step 2: Update COG Classic Event**
```sql
-- Update COG Classic 2026 event to use COG Classic template
UPDATE public.events 
SET template_id = 'cog-classic-2026'
WHERE slug = 'cog-classic-2026';
```

### **Step 3: Create Template Partials**

#### **Frill Elements Partial**
```html
<!-- frill-elements.mustache -->
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
```

#### **Badge Content Partial**
```html
<!-- badge-content.mustache -->
<div class="badge-content" style="position: relative; z-index: 10; padding: 15px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
  
  <!-- Profile Image -->
  <div class="profile-image-container" style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-bottom: 20px; background: #333;">
    {{#imageUrl}}
      <img src="{{imageUrl}}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" />
    {{/imageUrl}}
    {{^imageUrl}}
      <img src="/assets/question-placer@2x.png" alt="Question mark placeholder" style="width: 32px; height: 32px; object-contain; margin: 24px;" />
    {{/imageUrl}}
  </div>

  <!-- Badge Name -->
  <div class="badge-name" style="text-align: center; margin-bottom: 20px;">
    <h2 style="font-family: 'Montserrat', sans-serif; font-size: 24px; color: white; margin: 0; line-height: 1.2; word-break: break-word;">
      {{badgeName}}
    </h2>
  </div>

  <!-- Social Media Handles -->
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
```

### **Step 4: Template Data Structure**
```typescript
interface COGClassicTemplateData {
  // Core badge data
  badgeName: string;
  imageUrl?: string;
  
  // Social media handles (max 2)
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
    iconUrl: string;
  }>;
  
  // Decorative elements
  decorations: {
    frills: {
      left: boolean;
      right: boolean;
      lower: boolean;
    };
  };
  
  // Responsive scaling
  scaling: {
    base: number;
    sm: number;
    md: number;
    lg: number;
  };
}
```

## 🎨 **Template Features**

### **Preserved Design Elements**
- ✅ Dark gradient background (#0f2733 to #170a2a)
- ✅ 284x400px dimensions with responsive scaling
- ✅ 10px border radius
- ✅ Montserrat font family
- ✅ White text color
- ✅ Decorative frills (left, right, lower)
- ✅ Circular profile image
- ✅ Maximum 2 social media handles
- ✅ Platform-specific icons

### **Mustache Template Benefits**
- ✅ Dynamic content rendering
- ✅ Conditional frill display
- ✅ Flexible social media handling
- ✅ Easy template modification
- ✅ Version control friendly
- ✅ Database storage as TEXT

## 🔧 **Implementation Notes**

### **Asset Management**
- All decorative assets remain in `/public/assets/`
- Asset paths are hardcoded in template partials
- No changes to existing asset structure

### **Responsive Design**
- Template maintains current responsive scaling
- CSS classes preserved for consistency
- Mobile-first approach maintained

### **Backward Compatibility**
- COG Classic 2026 event continues to work
- Existing badge data remains compatible
- No breaking changes to user experience

## 📊 **Migration Verification**

### **Post-Migration Checklist**
- [ ] COG Classic template created in database
- [ ] COG Classic 2026 event linked to template
- [ ] Template partials created
- [ ] Badge rendering matches current design
- [ ] All decorative elements display correctly
- [ ] Social media icons work properly
- [ ] Responsive scaling functions
- [ ] PDF generation works with new template

### **Testing Scenarios**
1. **Basic Badge**: Name only, no image, no social media
2. **Full Badge**: Name, image, 2 social media handles
3. **Partial Badge**: Name, image, 1 social media handle
4. **Responsive**: Test on different screen sizes
5. **PDF Generation**: Verify PDF output matches preview

## 🚀 **Next Steps**

1. **Implement Mustache Template System**: Create the template rendering engine
2. **Create Template Partials**: Build the frill and content partials
3. **Update BadgePreview Component**: Integrate Mustache rendering
4. **Test COG Classic Template**: Verify design preservation
5. **Deploy and Monitor**: Ensure smooth transition

## 📝 **Template Maintenance**

### **Future Updates**
- Template modifications can be made directly in database
- No code changes required for design updates
- Version control through template versioning
- Easy A/B testing of different designs

### **Performance Considerations**
- Template caching for improved performance
- Asset optimization for faster loading
- Lazy loading of decorative elements
- CDN integration for static assets
