# Multi-Event Badge Creation Implementation Plan

## Overview

This document provides a detailed, phase-by-phase implementation plan for adding multi-event support to the Badge Maker application. Each phase builds upon the previous one and can be tested independently.

## Implementation Strategy

### Approach
- **Incremental Development**: Each phase delivers working functionality
- **Event Context First**: Implement event context before modifying components
- **Database Migration**: Gradual schema updates with data preservation
- **Clean Routes**: All routes now require event context
- **Name Field Splitting**: Convert single name field to separate first/last name fields

### Testing Strategy
- **Phase Testing**: Test each phase before proceeding
- **Integration Testing**: Verify phase interactions
- **Event Isolation**: Verify event-specific data separation
- **Route Validation**: Ensure all routes require valid event slugs
- **Name Field Validation**: Test first/last name handling and PDF generation

## Phase 1: Database Foundation

### 1.1 Create Database Migration
**File**: `supabase/multi_event_migration.sql`

```sql
-- Add events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  template_id TEXT REFERENCES public.templates(id), -- Single template per event
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add event_id columns to existing tables
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.waivers 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.badges 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Add separate name fields to waivers table
ALTER TABLE public.waivers 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing full_name data to first_name and last_name
UPDATE public.waivers 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Make name fields required after migration
ALTER TABLE public.waivers 
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON public.sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_waivers_event_id ON public.waivers(event_id);
CREATE INDEX IF NOT EXISTS idx_badges_event_id ON public.badges(event_id);
CREATE INDEX IF NOT EXISTS idx_waivers_names ON public.waivers(first_name, last_name);

-- Enable RLS on new tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view active events" ON public.events
  FOR SELECT USING (is_active = true);

-- Insert default event
INSERT INTO public.events (slug, name, description, start_date, end_date, template_id) VALUES
('default', 'Default Event', 'Default event for legacy support', NULL, NULL, 'badge-maker-default')
ON CONFLICT (slug) DO NOTHING;

-- Link existing data to default event
UPDATE public.sessions SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.waivers SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
UPDATE public.badges SET event_id = (SELECT id FROM public.events WHERE slug = 'default') WHERE event_id IS NULL;
```

### 1.2 Update Database Schema
**File**: `supabase/schema.sql`

- Add the new tables and columns to the main schema
- Include the default event setup
- **Updated**: Include firstName and lastName columns in waivers table
- Update RLS policies and indexes

### 1.3 Create Type Definitions
**File**: `src/types/event.ts`

```typescript
export interface Event {
  id: string;
  slug: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventData {
  event: Event;
  template: any; // Template configuration
}

// Updated user data interface
export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date;
  emergencyContact: string;
  emergencyPhone: string;
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
}
```

### 1.4 Testing Phase 1
- Run database migration
- Verify tables are created
- **Updated**: Verify firstName and lastName columns are added
- Check default event is inserted
- Confirm existing data is linked to default event
- **Updated**: Verify name data migration worked correctly
- Test RLS policies

## Phase 2: Routing and Context

### 2.1 Create Event Context Hook
**File**: `src/hooks/useEventContext.ts`

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { EventData } from '@/types/event';

export function useEventContext() {
  const params = useParams();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSlug = params?.eventName as string;

  useEffect(() => {
    async function loadEventData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/events/${eventSlug}`);
        
        if (!response.ok) {
          throw new Error('Event not found');
        }
        
        const data = await response.json();
        setEventData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
      }
    }

    if (eventSlug) {
      loadEventData();
    }
  }, [eventSlug]);

  return {
    eventSlug,
    eventData,
    loading,
    error
  };
}
```

### 2.2 Create Event API Routes
**File**: `src/app/api/events/[slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createClient();
    const { slug } = params;

    // Get event data
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get event template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', event.template_id)
      .single();

    if (templateError) {
      return NextResponse.json(
        { error: 'Failed to load template' },
        { status: 500 }
      );
    }
    
    const eventData = {
      event,
      template: template?.config || null
    };

    return NextResponse.json(eventData);
  } catch (error) {
    console.error('Event API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2.2 Create Dynamic Route Structure
**Directory Structure**:
```
src/app/
├── [eventName]/
│   ├── landing/
│   │   └── page.tsx
│   ├── waiver/
│   │   └── page.tsx
│   ├── badge/
│   │   └── page.tsx
│   └── confirmation/
│       └── page.tsx
```

### 2.3 Create Event Validation Middleware
**File**: `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if this is an event-specific route
  const eventMatch = pathname.match(/^\/([^\/]+)\/(landing|waiver|badge|confirmation)$/);
  
  if (eventMatch) {
    const [, eventSlug] = eventMatch;
    
    // Validate event slug format (lowercase, hyphens, no spaces)
    if (!/^[a-z0-9-]+$/.test(eventSlug)) {
      return NextResponse.redirect(new URL('/404', request.url));
    }
    
    // Allow the request to proceed
    return NextResponse.next();
  }
  
  // Redirect root to default event
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/default/landing', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 2.4 Testing Phase 2
- Test event context hook with valid events
- Verify API routes return correct data
- Test dynamic routing with various event names
- Confirm middleware validation works
- Test with invalid event names
- Verify root redirect to default event

## Phase 3: Event Management

### 3.1 Update State Management
**File**: `src/hooks/useUserFlowStore.ts`

```typescript
interface UserFlowState {
  // Updated name fields
  firstName: string;
  lastName: string;
  
  // Other existing fields
  email: string;
  dateOfBirth: Date;
  emergencyContact: string;
  emergencyPhone: string;
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
  
  // New event fields
  eventSlug: string;
  eventData: EventData | null;
  
  // Event-specific data
  eventPhotos: Record<string, string>;
  eventBadgeData: Record<string, BadgeData>;
  
  // Actions
  setEventData: (eventSlug: string, eventData: EventData) => void;
  setEventPhoto: (eventSlug: string, photoUrl: string) => void;
  setEventBadgeData: (eventSlug: string, badgeData: BadgeData) => void;
  clearEventData: (eventSlug: string) => void;
  
  // Updated name actions
  setFirstName: (firstName: string) => void;
  setLastName: (lastName: string) => void;
}
```

### 3.2 Create Event Header Component
**File**: `src/components/molecules/EventHeader.tsx`

```typescript
import { EventData } from '@/types/event';
import { format } from 'date-fns';

interface EventHeaderProps {
  eventData: EventData;
}

export function EventHeader({ eventData }: EventHeaderProps) {
  const { event } = eventData;
  
  const formatDate = (date: Date | string) => {
    if (!date) return null;
    return format(new Date(date), 'MMM d, yyyy');
  };
  
  const dateRange = event.startDate && event.endDate 
    ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`
    : null;

  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">
        {event.name}
      </h1>
      {event.description && (
        <p className="text-lg text-gray-600 mb-2">
          {event.description}
        </p>
      )}
      {dateRange && (
        <p className="text-md text-gray-500">
          {dateRange}
        </p>
      )}
      <div className="mt-4 text-sm text-gray-400">
        BADGE-O-MATIC
      </div>
    </div>
  );
}
```

### 3.3 Update Storage Organization
**File**: `src/lib/utils/storage.ts`

```typescript
export function getEventStoragePath(eventSlug: string, type: 'badge-images' | 'waiver-documents') {
  return `${type}/${eventSlug}`;
}

export function getEventImagePath(eventSlug: string, sessionId: string, timestamp: number, type: 'original' | 'cropped') {
  const extension = type === 'original' ? 'jpg' : 'blob';
  return `${getEventStoragePath(eventSlug, 'badge-images')}/${type}/${sessionId}-${timestamp}.${extension}`;
}

// Updated to use separate firstName and lastName
export function getEventWaiverPath(eventSlug: string, firstName: string, lastName: string, eventName: string, date: Date) {
  const formattedFirstName = firstName.replace(/\s+/g, '_');
  const formattedLastName = lastName.replace(/\s+/g, '_');
  const formattedEvent = eventName.replace(/\s+/g, '');
  const formattedDate = format(date, 'yyyy-MM-dd');
  return `${getEventStoragePath(eventSlug, 'waiver-documents')}/${formattedFirstName}_${formattedLastName}_${formattedEvent}_${formattedDate}.pdf`;
}
```

### 3.4 Testing Phase 3
- Test event header display
- Verify state management with events
- Test storage path generation
- **Updated**: Test PDF naming with firstName/lastName
- Confirm event-specific data isolation

## Phase 4: Component Updates

### 4.1 Update Landing Form
**File**: `src/components/organisms/LandingForm.tsx`

- Integrate with event context
- Display event header
- **Updated**: Split single name input into firstName and lastName fields
- Store event context in state
- Handle event-specific form data
- **Updated**: Validate firstName and lastName separately

### 4.2 Update Waiver Form
**File**: `src/components/organisms/WaiverForm.tsx`

- Use event context for waiver content
- **Updated**: Display firstName and lastName separately
- Generate event-specific PDF names using separate fields
- Store waivers in event folders
- Display event information

### 4.3 Update Badge Creation Form
**File**: `src/components/organisms/BadgeCreationForm.tsx`

- Use event-specific template (no template selection)
- Store event-specific badge data
- Manage event-specific photos
- Display event branding

### 4.4 Update API Routes
**Files**: 
- `src/app/api/pdf/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/badges/route.ts`

- Accept eventSlug parameter
- **Updated**: Accept firstName and lastName instead of fullName
- Use event-specific storage paths
- Generate event-specific file names
- Link data to events

### 4.5 Testing Phase 4
- Test component integration
- **Updated**: Test firstName/lastName field handling
- Verify event-specific functionality
- Test API route updates
- **Updated**: Test PDF generation uses firstName/lastName
- Confirm data isolation

## Phase 5: Testing and Migration

### 5.1 Integration Testing
- Test complete user flow with events
- Verify event-specific data handling
- **Updated**: Test name field splitting throughout the flow
- Test event validation
- **Updated**: Test PDF naming consistency
- Confirm error handling

### 5.2 Performance Testing
- Test with multiple events
- Verify caching strategies
- Test storage operations
- Monitor bundle sizes

### 5.3 Migration Testing
- Test data migration scripts
- **Updated**: Test name field migration from fullName
- Verify event functionality
- Test event creation process
- Confirm template management

### 5.4 Documentation Updates
- Update API documentation
- Update component documentation
- Create event management guide
- Update deployment instructions

## Testing Checklist

### Phase 1: Database
- [ ] Tables created successfully
- [ ] Default event inserted
- [ ] **Updated**: firstName and lastName columns added to waivers
- [ ] **Updated**: Name data migration completed successfully
- [ ] Existing data linked to default event
- [ ] RLS policies working
- [ ] Indexes created

### Phase 2: Routing
- [ ] Event context hook working
- [ ] API routes returning data
- [ ] Dynamic routing functional
- [ ] Middleware validation working
- [ ] Invalid events handled
- [ ] Root redirects to default event

### Phase 3: Event Management
- [ ] Event header displaying correctly
- [ ] State management working
- [ ] Storage paths generated correctly
- [ ] **Updated**: PDF naming with firstName/lastName working
- [ ] Event data isolation confirmed

### Phase 4: Components
- [ ] **Updated**: Landing form has separate firstName/lastName fields
- [ ] Landing form integrated
- [ ] **Updated**: Waiver form displays firstName/lastName separately
- [ ] Waiver form updated
- [ ] Badge creation working
- [ ] API routes updated
- [ ] **Updated**: PDF generation uses firstName/lastName
- [ ] Event-specific data handling

### Phase 5: Integration
- [ ] Complete user flow working
- [ ] **Updated**: Name field splitting works throughout flow
- [ ] Event validation confirmed
- [ ] **Updated**: PDF naming is consistent and reliable
- [ ] Performance acceptable
- [ ] Error handling working
- [ ] Documentation updated

## Rollback Plan

### If Issues Arise
1. **Database Rollback**: Drop new tables and columns
2. **Code Rollback**: Revert to previous commit
3. **Data Recovery**: Restore from backup if needed
4. **Gradual Rollout**: Test with subset of users first

### Rollback Commands
```sql
-- Remove event columns
ALTER TABLE public.sessions DROP COLUMN IF EXISTS event_id;
ALTER TABLE public.waivers DROP COLUMN IF EXISTS event_id;
ALTER TABLE public.badges DROP COLUMN IF EXISTS event_id;

-- Remove name field changes (if needed)
ALTER TABLE public.waivers DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.waivers DROP COLUMN IF EXISTS last_name;

-- Drop new tables
DROP TABLE IF EXISTS public.events CASCADE;
```

## Success Criteria

### Functional Requirements
- [ ] Users can access events via URL
- [ ] Event-specific data is isolated
- [ ] Templates work per event (one template per event)
- [ ] Storage is organized by event
- [ ] All routes require event context
- [ ] **Updated**: Name fields are properly split and handled

### Performance Requirements
- [ ] Page load times < 2 seconds
- [ ] Bundle size increase < 20%
- [ ] Database queries < 100ms
- [ ] Storage operations < 1 second

### Quality Requirements
- [ ] 100% test coverage for new features
- [ ] No breaking changes to existing API
- [ ] Comprehensive error handling
- [ ] Full documentation coverage
- [ ] **Updated**: Name field validation and PDF naming consistency

## Timeline Estimate

- **Phase 1**: 2-3 days (Database setup + name field migration)
- **Phase 2**: 2-3 days (Routing and context)
- **Phase 3**: 2-3 days (Event management + PDF naming updates)
- **Phase 4**: 4-5 days (Component updates + name field splitting)
- **Phase 5**: 2-3 days (Testing and migration)

**Total Estimated Time**: 12-17 days

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up development environment** for multi-event testing
3. **Begin Phase 1** with database migration and name field updates
4. **Test each phase** before proceeding
5. **Deploy incrementally** to staging environment
6. **Monitor performance** and user feedback
7. **Plan production rollout** with feature flags
