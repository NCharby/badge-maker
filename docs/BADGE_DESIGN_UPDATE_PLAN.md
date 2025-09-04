# Badge Design Update Project Plan

## 🎯 **Project Overview**
Update the default badge design to match the new Figma design with decorative fill elements and reduce social media handles from 3 to 2 maximum.

## 📋 **Current State Analysis**

### **Existing Badge Design**
- **Current Layout**: Simple yellow background (`#ffcc00`) with rounded corners
- **Dimensions**: 587px × 983px (3.5" × 2.25" at 300 DPI)
- **Components**: Badge name, circular photo (400px), up to 3 social media handles
- **Social Icons**: Text-based abbreviations (X, BS, TG, etc.)
- **Typography**: Open Sans font family

### **Current Social Media Implementation**
- **Maximum Handles**: 3 social media handles
- **Platform Support**: X, BlueSky, Telegram, Recon, FurAffinity, FetLife, Discord, Instagram, Other
- **Display Method**: Text abbreviations in small boxes
- **Database Storage**: JSONB array in `social_media_handles` field

## 🎨 **New Design Requirements**

### **Visual Elements to Add**
1. **Decorative Fill Elements** (from `design/badge-parts/`):
   - `frill-left.png/svg` - Left decorative element
   - `frill-right.png/svg` - Right decorative element  
   - `frill-lower.png/svg` - Lower decorative element

2. **Social Media Icons** (from `design/social-icons-set/`):
   - Replace text abbreviations with actual platform icons
   - Use white icons for better contrast on yellow background
   - Support all current platforms: X, BlueSky, Telegram, Recon, FurAffinity, FetLife, Discord, Instagram

### **Layout Changes**
- **Social Media Limit**: Reduce from 3 to 2 maximum handles
- **Icon Integration**: Replace text-based platform indicators with visual icons
- **Decorative Elements**: Integrate frill elements as background decorations

## 📝 **Implementation Tasks**

### **Phase 1: Asset Integration & Setup**
- [ ] **1.1** Copy badge-parts assets to `public/assets/badge-parts/`
- [ ] **1.2** Copy social-icons-set assets to `public/assets/social-icons/`
- [ ] **1.3** Create asset mapping configuration for platform icons
- [ ] **1.4** Update Next.js config if needed for asset optimization

### **Phase 2: Database Schema Updates**
- [ ] **2.1** Update validation schema to limit social media handles to 2
- [ ] **2.2** Update database schema comments to reflect new limit
- [ ] **2.3** Create migration script for existing data (if needed)
- [ ] **2.4** Update TypeScript types to reflect new limits

### **Phase 3: Component Updates**

#### **BadgePreview Component**
- [ ] **3.1** Add decorative frill elements as background images
- [ ] **3.2** Replace text-based social media indicators with icon images
- [ ] **3.3** Update layout to accommodate only 2 social media handles
- [ ] **3.4** Ensure proper positioning and sizing of decorative elements
- [ ] **3.5** Test responsive behavior and image loading

#### **SocialMediaInput Component**
- [ ] **3.6** Update maximum handle limit from 3 to 2
- [ ] **3.7** Update form validation messages
- [ ] **3.8** Update UI labels and placeholders
- [ ] **3.9** Test form behavior with new limits

#### **BadgeCreationForm Component**
- [ ] **3.10** Update validation schema to enforce 2-handle limit
- [ ] **3.11** Update error messages and form validation
- [ ] **3.12** Test form submission with new limits

### **Phase 4: Type System Updates**
- [ ] **4.1** Update `SocialMediaHandle` interface if needed
- [ ] **4.2** Update `BadgeData` interface validation
- [ ] **4.3** Update form validation schemas (Zod)
- [ ] **4.4** Update API validation on backend

### **Phase 5: API & Backend Updates**
- [ ] **5.1** Update badge creation API validation
- [ ] **5.2** Update confirmation email templates if they reference social handles
- [ ] **5.3** Update any analytics tracking for social media counts
- [ ] **5.4** Test API endpoints with new validation

### **Phase 6: Testing & Validation**
- [ ] **6.1** Test badge creation flow with 2 social handles
- [ ] **6.2** Test badge creation flow with 1 social handle
- [ ] **6.3** Test badge creation flow with 0 social handles
- [ ] **6.4** Verify decorative elements display correctly
- [ ] **6.5** Verify social media icons display correctly
- [ ] **6.6** Test responsive design on different screen sizes
- [ ] **6.7** Test image loading and fallbacks
- [ ] **6.8** Verify PDF generation still works correctly

### **Phase 7: Documentation & Cleanup**
- [ ] **7.1** Update component documentation
- [ ] **7.2** Update API documentation
- [ ] **7.3** Update project README if needed
- [ ] **7.4** Remove any unused code or assets
- [ ] **7.5** Update CURRENT_STATUS.md

## 🔧 **Technical Implementation Details**

### **Asset Organization**
```
public/assets/
├── badge-parts/
│   ├── frill-left.svg
│   ├── frill-right.svg
│   └── frill-lower.svg
└── social-icons/
    ├── x-icon-white.svg
    ├── bluesky-icon-white.svg
    ├── telegram-icon-white.svg
    ├── recon-icon-color.svg
    ├── furaffinity-icon-white.svg
    ├── fetlife-icon-white.svg
    ├── discord-icon-white.svg
    └── instagram-icon-white.svg
```

### **Platform Icon Mapping**
```typescript
const platformIconMap = {
  x: '/assets/social-icons/x-icon-white.svg',
  bluesky: '/assets/social-icons/bluesky-icon-white.svg',
  telegram: '/assets/social-icons/telegram-icon-white.svg',
  recon: '/assets/social-icons/recon-icon-color.svg',
  furaffinity: '/assets/social-icons/furaffinity-icon-white.svg',
  fetlife: '/assets/social-icons/fetlife-icon-white.svg',
  discord: '/assets/social-icons/discord-icon-white.svg',
  instagram: '/assets/social-icons/instagram-icon-white.svg',
  other: null // No icon for 'other' platform
}
```

### **CSS Layout Updates**
- Add decorative elements as background images with absolute positioning
- Update social media section to only show 2 handles
- Ensure proper z-index layering for decorative elements
- Maintain responsive design principles

### **Validation Updates**
```typescript
// Update from max(3) to max(2)
social_media_handles: z.array(z.object({
  platform: z.enum([...]),
  handle: z.string().min(1, 'Handle is required')
})).max(2, 'Maximum 2 social media handles allowed')
```

## ⚠️ **Potential Risks & Considerations**

### **Breaking Changes**
- **Existing Data**: Users with 3 social handles will need to be handled gracefully
- **Form Validation**: Existing sessions with 3 handles may cause validation errors
- **API Compatibility**: Backend validation changes may affect existing integrations

### **Migration Strategy**
- **Graceful Degradation**: Show only first 2 handles for existing badges with 3
- **Form Pre-population**: When editing existing badges, only populate first 2 handles
- **Database**: No schema changes needed, just validation updates

### **Performance Considerations**
- **Image Loading**: Additional SVG assets may impact initial load time
- **Bundle Size**: Ensure decorative elements don't significantly increase bundle size
- **Caching**: Implement proper caching for new assets

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ Badge design matches new Figma specifications
- ✅ Maximum 2 social media handles enforced
- ✅ Social media icons display correctly
- ✅ Decorative elements render properly
- ✅ All existing functionality preserved
- ✅ Responsive design maintained

### **Technical Requirements**
- ✅ No breaking changes to existing data
- ✅ Form validation works correctly
- ✅ API endpoints handle new validation
- ✅ PDF generation still works
- ✅ Performance impact minimized

### **User Experience**
- ✅ Smooth transition for existing users
- ✅ Clear validation messages
- ✅ Intuitive form behavior
- ✅ Visual design improvements are noticeable

## 📅 **Estimated Timeline**
- **Phase 1-2**: 1-2 hours (Asset setup & schema updates)
- **Phase 3**: 3-4 hours (Component updates)
- **Phase 4-5**: 1-2 hours (Type system & API updates)
- **Phase 6**: 2-3 hours (Testing & validation)
- **Phase 7**: 1 hour (Documentation)

**Total Estimated Time**: 8-12 hours

## 🔄 **Next Steps**
1. Review and approve this project plan
2. Begin with Phase 1: Asset Integration & Setup
3. Implement changes incrementally with testing at each phase
4. Validate against production environment before final deployment
