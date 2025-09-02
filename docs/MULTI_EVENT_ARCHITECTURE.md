# Multi-Event Badge Creation Architecture

## Overview

This document outlines the architecture and implementation plan for extending the Badge Maker application to support multiple events.

## Feature Summary

The multi-event system allows:
- **Event-specific routing** via URL patterns like `/[event-name]/landing`
- **Event-specific badge templates** with unique designs per event
- **Event metadata display** (dates, description) in the UI
- **Separate waivers per event** with human-readable PDF naming
- **Event-specific user data** (different photos, information per event)
- **Improved name handling** with separate first and last name fields

## User Flow

### Current Flow (Single Event)
```
/landing → /waiver → /badge → /confirmation
```

### New Flow (Multi-Event)
```
/[event-name]/landing → /[event-name]/waiver → /[event-name]/badge → /[event-name]/confirmation
```

### Event Selection
- Users access events via direct URL (e.g., `/cogweekend2024/landing`)
- Event name is extracted from URL and used throughout the session
- All subsequent pages maintain the event context

## Technical Architecture

### 1. Routing Structure

#### New Route Pattern
```
/[event-name]/landing      # Event-specific landing page
/[event-name]/waiver       # Event-specific waiver signing
/[event-name]/badge        # Event-specific badge creation
/[event-name]/confirmation # Event-specific confirmation
```

#### Event Validation
- Event names must match database records
- Invalid event names redirect to 404
- Event names are URL-safe (lowercase, hyphens, no spaces)

### 2. Database Schema Changes

#### New Tables

**`events` Table**
```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL, -- URL-safe identifier (e.g., 'cogweekend2024')
  name TEXT NOT NULL, -- Display name (e.g., 'COG Weekend 2024')
  description TEXT, -- Event description
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  template_id TEXT REFERENCES public.templates(id), -- Single template per event
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Note**: Removed `event_templates` junction table since each event has exactly one template.

#### Modified Tables

**`sessions` Table**
```sql
ALTER TABLE public.sessions 
ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
```

**`waivers` Table**
```sql
-- Add new name fields
ALTER TABLE public.waivers 
ADD COLUMN first_name TEXT NOT NULL,
ADD COLUMN last_name TEXT NOT NULL;

-- Add event relationship
ALTER TABLE public.waivers 
ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Note: full_name column will be migrated and eventually removed
```

**`badges` Table**
```sql
ALTER TABLE public.badges 
ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
```

**`templates` Table**
```sql
-- No changes needed - existing structure supports event-specific usage
```

### 3. Storage Structure

#### File Organization
```
badge-images/
├── [event-slug]/
│   ├── original/
│   │   └── [session-id]-[timestamp].jpg
│   └── cropped/
│       └── [session-id]-[timestamp].blob

waiver-documents/
├── [event-slug]/
│   └── [FirstName]_[LastName]_[EventName]_[YYYY-MM-DD].pdf
```

#### PDF Naming Convention
```
[FirstName]_[LastName]_[EventName]_[YYYY-MM-DD].pdf
Example: John_Doe_COGWeekend2024_2024-12-19.pdf
```

**Note**: With separate first_name and last_name fields, PDF naming becomes more reliable and consistent.

### 4. State Management Updates

#### Zustand Store Changes
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
  
  // New fields
  eventSlug: string;
  eventData: EventData | null;
  
  // Event-specific data
  eventPhotos: Record<string, string>; // eventSlug -> photoUrl
  eventBadgeData: Record<string, BadgeData>; // eventSlug -> badgeData
}
```

#### Event Context
- Event information is loaded on page load
- Event context persists throughout the user session
- Event-specific data is stored separately per event

### 5. Component Updates

#### New Components

**`EventHeader` (Molecule)**
- Displays event name, dates, and description
- Replaces the static "BADGE-O-MATIC" header
- Shows event-specific branding

**`EventContextProvider` (Organism)**
- Provides event context to child components
- Handles event data loading and validation
- Manages event-specific state

#### Modified Components

**`LandingForm`**
- Accepts event context from URL
- **Updated**: Split single name input into firstName and lastName fields
- Pre-populates event-specific information
- Stores event context in state

**`WaiverForm`**
- Displays event-specific waiver content
- **Updated**: Shows firstName and lastName separately
- Generates event-specific PDF names using separate fields
- Stores waivers in event-specific folders

**`BadgeCreationForm`**
- Uses event-specific template (no template selection)
- Stores event-specific badge data
- Manages event-specific photos

### 6. API Route Updates

#### New Routes

**`/api/events/[slug]`**
```typescript
GET /api/events/[slug] - Get event information
Response: EventData with template, dates, description
```

#### Modified Routes

**`/api/pdf`**
- Accepts `eventSlug` parameter
- **Updated**: Accepts `firstName` and `lastName` instead of `fullName`
- Stores PDFs in event-specific folders
- Generates event-specific file names

**`/api/upload`**
- Accepts `eventSlug` parameter
- Stores images in event-specific folders
- Maintains session-based organization

**`/api/badges`**
- Accepts `eventSlug` parameter
- Stores event-specific badge data
- Links badges to specific events

### 7. Template System Enhancement

#### Event-Specific Templates
- Each event has exactly one badge template
- Templates can be shared between events
- No template selection UI needed
- Template previews show event-specific branding

#### Template Configuration
```json
{
  "dimensions": {"width": 3.5, "height": 2.25},
  "layout": {
    "imagePosition": {"x": 0.25, "y": 0.5, "width": 0.4, "height": 0.4},
    "textPositions": {
      "badge_name": {"x": 0.7, "y": 0.3, "width": 0.25, "align": "left"},
      "email": {"x": 0.7, "y": 0.5, "width": 0.25, "align": "left"},
      "social_media": {"x": 0.7, "y": 0.7, "width": 0.25, "align": "left"}
    }
  },
  "eventBranding": {
    "logo": "event-logo.png",
    "colors": {"primary": "#3b82f6", "secondary": "#1f2937"},
    "fonts": {"primary": "Inter", "secondary": "Open Sans"}
  }
}
```

## Implementation Phases

### Phase 1: Database Foundation
1. Create new database tables (`events`)
2. Add event_id columns to existing tables
3. **Updated**: Add firstName and lastName columns to waivers table
4. Create database migrations
5. Update RLS policies

### Phase 2: Routing and Context
1. Implement dynamic routing with `[event-name]` parameter
2. Create event context provider
3. Add event validation middleware
4. Update navigation components

### Phase 3: Event Management
1. Create event CRUD operations
2. Implement event-specific templates
3. Add event metadata display
4. Update storage organization
5. **Updated**: Update PDF naming functions to use firstName/lastName

### Phase 4: Component Updates
1. **Updated**: Split name input fields in LandingForm
2. Modify existing components to use event context
3. Create new event-specific components
4. Update state management
5. Implement event-specific data handling

### Phase 5: Testing and Migration
1. Test multi-event functionality
2. Verify event-specific features
3. **Updated**: Test name field splitting and PDF naming
4. Create sample events and templates
5. Update documentation

## Data Migration

### Migration Strategy
- Existing sessions, waivers, and badges are linked to default event
- **Updated**: Existing `full_name` data is parsed into `first_name` and `last_name`
- No data loss during migration
- Clean transition to event-specific structure

### Default Event Setup
- Create default event for existing data
- Link all existing records to default event
- **Updated**: Parse existing full names into first/last names
- Maintain data integrity during transition

### Name Field Migration
```sql
-- Parse existing full_name into first_name and last_name
UPDATE public.waivers 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE full_name IS NOT NULL;

-- Handle edge cases (single names, multiple spaces)
-- Note: This is a simplified approach - production migration may need more sophisticated parsing
```

## Security Considerations

### Event Access Control
- Event slugs are validated against database
- Users can only access active events
- Event-specific data isolation

### File Access
- Event-specific storage folders
- Signed URLs for file access
- RLS policies for event data

### Data Privacy
- Event-specific waiver agreements
- Separate user data per event
- Audit trails for event-specific actions

## Performance Considerations

### Caching Strategy
- Event data cached at component level
- Template data cached per event
- Session data cached with event context

### Database Optimization
- Indexes on event_id columns
- **Updated**: Indexes on first_name and last_name for search optimization
- Efficient event template queries
- Optimized storage path generation

### Bundle Optimization
- Event-specific code splitting
- Lazy loading of event templates
- Efficient state management

## Monitoring and Analytics

### Event Metrics
- Badge creation per event
- Waiver completion rates
- User engagement per event
- Template usage statistics

### Error Tracking
- Event-specific error logging
- Invalid event access attempts
- Template rendering failures
- Storage operation errors

## Future Enhancements

### Event Management Dashboard
- Admin interface for event creation
- Template management per event
- User analytics per event
- Event-specific settings

### Multi-Event User Accounts
- User registration per event
- Cross-event data sharing
- Event-specific preferences
- Unified user dashboard

### Advanced Templates
- Event-specific branding rules
- Dynamic template generation
- A/B testing for templates
- Template performance metrics
