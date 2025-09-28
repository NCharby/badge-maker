# Badge Maker - Architecture Overview

## 🏗️ **System Architecture**

Badge Maker follows a modern, scalable architecture built on Next.js 14 with a focus on performance, security, and maintainability.

## 🔄 **Architecture Pattern**

### **Frontend Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Landing Page  │───▶│  Waiver Signing │───▶│ Badge Creation  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   State Store   │    │   PDF Service   │    │  Image Service  │
│   (Zustand)     │    │  (Puppeteer)    │    │  (Supabase)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Backend Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Next.js API   │───▶│   Supabase      │───▶│   PostgreSQL    │
│     Routes     │    │   Database      │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Puppeteer     │    │   Supabase      │    │   Postmark      │
│  PDF Service    │    │    Storage      │    │  Email Service  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 **Core Design Principles**

### **1. Separation of Concerns**
- **Frontend**: React components with clear responsibilities
- **Backend**: API routes handling specific business logic
- **Database**: Data storage with business rules in RLS policies
- **Storage**: File management with access control

### **2. Component Architecture**
- **Atomic Design**: Atoms → Molecules → Organisms → Pages
- **Single Responsibility**: Each component has one clear purpose
- **Reusability**: Components designed for multiple use cases
- **Composition**: Complex components built from simple ones

### **3. State Management**
- **Local State**: Component-specific state with React hooks
- **Global State**: Cross-component data with Zustand
- **Persistence**: Local storage for user experience continuity
- **Validation**: Form state with React Hook Form + Zod

## 🗄️ **Data Architecture**

### **Badge Template System**

**Current Implementation**: The badge system uses **hardcoded per-event badge previews** for simplicity and reliability.

#### **Hardcoded Per-Event Architecture**
- **Event-Specific Components**: Each event has its own `BadgePreview.tsx` component
- **Factory Pattern**: Event badge components selected via factory pattern
- **Design Source**: Figma specifications hardcoded in JSX/Tailwind CSS
- **Database**: Templates table stores metadata only (no dynamic rendering)

#### **Benefits**
- **Simplicity**: No database complexity for template management
- **Performance**: No template queries or rendering overhead
- **Reliability**: No risk of template corruption or missing data
- **Type Safety**: Full TypeScript support for each template
- **Version Control**: All design changes tracked in Git

#### **Adding New Events**
1. Create event-specific badge component
2. Update factory pattern to include new event
3. Add database metadata entry
4. Deploy code changes

#### **Architecture Decision**
This approach prioritizes **reliability and simplicity** over flexibility. While it requires code changes for new events, it eliminates the complexity and potential issues of a dynamic template system.

**See**: `docs/HARDCODED_BADGE_ARCHITECTURE.md` for detailed implementation guide.

### **Database Schema**
```sql
-- Core entities
events (id, slug, name, description, dates, template_id, telegram_config)
templates (id, name, config, is_active)
sessions (id, event_id, created_at, expires_at)
waivers (id, session_id, event_id, first_name, last_name, ...)
badges (id, session_id, event_id, waiver_id, badge_name, ...)
telegram_invites (id, event_id, session_id, invite_link, expires_at, created_at)

-- Relationships
events → templates (1:1)
events → sessions (1:many)
events → waivers (1:many)
events → badges (1:many)
events → telegram_invites (1:many)
sessions → waivers (1:1)
sessions → telegram_invites (1:1)
waivers → badges (1:1)
```

### **Storage Architecture**
```
Supabase Storage
├── badge-images/          # Badge photo storage
│   ├── original/         # Original uploaded images
│   └── cropped/          # Processed cropped images
└── waiver-documents/     # Signed waiver PDFs
    └── [event-name]/     # Event-specific organization
```

### **Data Flow**
1. **User Input** → Form validation → State store
2. **State Store** → API calls → Database
3. **File Upload** → Processing → Storage bucket
4. **PDF Generation** → Storage → Consolidated confirmation email

## 🔒 **Security Architecture**

### **Authentication & Authorization**
- **Row Level Security (RLS)**: Database-level access control
- **Signed URLs**: Time-limited access to stored files
- **Input Validation**: Client and server-side validation
- **Error Handling**: Secure error messages without data leakage

### **Data Protection**
- **Private Storage**: All files stored in private buckets
- **Access Control**: RLS policies enforce data isolation
- **Audit Trails**: Complete tracking of user actions
- **Data Retention**: Configurable storage policies

## 🚀 **Performance Architecture**

### **Frontend Optimization**
- **Code Splitting**: Dynamic imports for route-based chunks
- **Image Optimization**: Next.js Image component with optimization
- **Bundle Optimization**: Tree shaking and dead code elimination
- **Caching**: Static generation and incremental static regeneration

### **Backend Optimization**
- **API Routes**: Server-side rendering and API endpoints
- **Database Indexing**: Optimized queries with proper indexes
- **Storage CDN**: Global distribution via Supabase
- **PDF Generation**: Asynchronous processing with Puppeteer

## 🔌 **Integration Architecture**

### **External Services**
- **Supabase**: Database, storage, and authentication
- **Postmark**: Consolidated confirmation email with template system
- **Puppeteer**: Server-side PDF generation
- **Telegram Bot API**: Automatic invite link generation
- **Next.js**: Framework and deployment platform

### **API Design**
- **RESTful**: Standard HTTP methods and status codes
- **TypeScript**: Full type safety across the stack
- **Error Handling**: Consistent error response format
- **Validation**: Request and response validation

## 🤖 **Telegram Integration Architecture**

### **Service Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  TelegramLinks  │───▶│ TelegramService │───▶│ TelegramBotAPI  │
│   Component     │    │  (Orchestrator) │    │   (External)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │ DatabaseService │    │   Supabase      │
│  (/api/telegram)│    │  (Invite Mgmt)  │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Integration Features**
- **Automatic Invite Generation**: Creates unique, one-time-use invite links
- **Multi-Event Support**: Event-specific Telegram configurations
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Security**: Bot tokens stored in environment variables
- **Database Integration**: Proper foreign key relationships and constraints

### **API Endpoints**
- `GET /api/telegram/test-connection` - Test bot connectivity
- `GET /api/telegram/group-info` - Get event Telegram configuration
- `POST /api/telegram/generate-invite` - Create new invite link

### **Data Flow**
1. **Component Load** → Auto-generate invite if none exists
2. **API Call** → Telegram service orchestration
3. **Bot API** → Create invite link via Telegram
4. **Database** → Store invite with session relationship
5. **UI Update** → Display invite link to user

## 📱 **Responsive Architecture**

### **Mobile-First Design**
- **Breakpoints**: Mobile (320px) → Tablet (768px) → Desktop (1024px+)
- **Touch Optimization**: Proper touch targets and spacing
- **Performance**: Optimized for mobile network conditions
- **Accessibility**: Screen reader and keyboard navigation support

### **Component Responsiveness**
- **Flexible Layouts**: CSS Grid and Flexbox for adaptive layouts
- **Typography Scaling**: Responsive font sizes and spacing
- **Image Handling**: Optimized image sizes for different devices
- **Form Design**: Mobile-optimized input fields and buttons

## 🔄 **State Management Architecture**

### **Zustand Store Structure**
```typescript
interface UserFlowState {
  // Event context
  eventSlug: string;
  
  // Landing form data
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
  
  // Actions
  setEventSlug: (slug: string) => void;
  setLandingData: (data: LandingData) => void;
  reset: () => void;
}
```

### **State Persistence**
- **Local Storage**: User data persists across browser sessions
- **Serialization**: Custom serialization for Date objects
- **Hydration**: State restoration on page reload
- **Validation**: State validation before persistence

## 🧪 **Testing Architecture**

### **Testing Strategy**
- **Manual Testing**: Comprehensive user flow testing
- **Error Handling**: Robust error scenarios and recovery
- **Performance Testing**: Load testing and optimization
- **Security Testing**: Vulnerability assessment and mitigation

### **Quality Assurance**
- **TypeScript**: Compile-time error checking
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting standards
- **Build Validation**: Production build verification

## 🚀 **Deployment Architecture**

### **Deployment Options**
- **Vercel**: Zero-config Next.js deployment
- **Self-Hosted**: Docker containers with environment configs
- **Hybrid**: Frontend on CDN, backend on dedicated servers

### **Environment Management**
- **Development**: Local Supabase instance
- **Staging**: Supabase staging environment
- **Production**: Supabase production environment
- **Configuration**: Environment-specific variables

## 📈 **Scalability Architecture**

### **Horizontal Scaling**
- **Stateless Design**: No server-side state dependencies
- **Database Scaling**: Supabase handles database scaling
- **Storage Scaling**: Automatic storage scaling via Supabase
- **CDN Distribution**: Global content delivery

### **Performance Monitoring**
- **Built-in Logging**: Error tracking and user analytics
- **Performance Metrics**: Core Web Vitals monitoring
- **Error Tracking**: Comprehensive error reporting
- **User Analytics**: Usage patterns and optimization

---

**Last Updated**: January 2025  
**Architecture Version**: 2.2.0 (With Hardcoded Badge Design)  
**Status**: Production Ready  
**Next Review**: As needed for new features
