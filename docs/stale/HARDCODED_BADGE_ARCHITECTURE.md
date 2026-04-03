# Hardcoded Badge Architecture

## Overview

The badge maker system uses **hardcoded badge previews per event** instead of dynamic database-driven templates. Each event has its own dedicated badge component with a fixed design that matches the event's branding and requirements.

## Architecture Decision

### Why Hardcoded Templates?

1. **Simplicity**: No database complexity for template management
2. **Performance**: No database queries for template rendering
3. **Reliability**: No risk of template corruption or missing data
4. **Version Control**: Template changes are tracked in code
5. **Type Safety**: Full TypeScript support for each template

### Trade-offs

- **Flexibility**: New events require code changes
- **Maintenance**: Designers need developer assistance for template changes
- **Scalability**: Each event needs its own component

## Current Implementation

### Event-Specific Badge Components

Each event has its own badge preview component located at:
```
src/components/events/[event-slug]/BadgePreview.tsx
```

### Example Structure

```
src/components/events/
├── cog-classic-2026/
│   └── BadgePreview.tsx
├── fall-cog-2025/
│   └── BadgePreview.tsx
├── default/
│   └── BadgePreview.tsx
└── index.ts
```

### Component Interface

All event badge components implement a consistent interface:

```typescript
interface EventBadgePreviewProps {
  badgeData: {
    badge_name: string;
    social_media_handles: SocialMediaHandle[];
  };
  imageUrl?: string;
}
```

## Database Schema

### Simplified Templates Table

The `templates` table is simplified to only store metadata:

```sql
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_slug TEXT UNIQUE NOT NULL, -- Links to event
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Events Table

Events reference templates for metadata only:

```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  template_id TEXT REFERENCES public.templates(id), -- Metadata only
  telegram_config JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Component Architecture

### Event Badge Factory

A factory pattern determines which badge component to render:

```typescript
// src/components/events/index.ts
export function getEventBadgeComponent(eventSlug: string) {
  switch (eventSlug) {
    case 'cog-classic-2026':
      return dynamic(() => import('./cog-classic-2026/BadgePreview'));
    case 'fall-cog-2025':
      return dynamic(() => import('./fall-cog-2025/BadgePreview'));
    case 'default':
      return dynamic(() => import('./default/BadgePreview'));
    default:
      return dynamic(() => import('./default/BadgePreview'));
  }
}
```

### Usage in Pages

```typescript
// In BadgeCreationForm.tsx
import { getEventBadgeComponent } from '@/components/events';

const EventBadgePreview = getEventBadgeComponent(eventSlug);

return (
  <EventBadgePreview 
    badgeData={data} 
    imageUrl={imageUrl}
  />
);
```

## Asset Management

### Event-Specific Assets

Each event can have its own asset directory:

```
public/assets/events/
├── cog-classic-2026/
│   ├── frill-left.svg
│   ├── frill-right.svg
│   ├── frill-lower.svg
│   └── background.svg
└── default/
    ├── frill-left.svg
    ├── frill-right.svg
    ├── frill-lower.svg
    └── background.svg
```

### Shared Assets

Common assets remain in the main assets directory:

```
public/assets/
├── social-icons/
├── question-placer@2x.png
└── shared/
```

## Development Workflow

### Adding a New Event

1. **Create Event Component**:
   ```bash
   mkdir src/components/events/new-event-slug
   touch src/components/events/new-event-slug/BadgePreview.tsx
   ```

2. **Implement Badge Component**:
   ```typescript
   export function BadgePreview({ badgeData, imageUrl }: EventBadgePreviewProps) {
     return (
       <div className="badge-container">
         {/* Event-specific design */}
       </div>
     );
   }
   ```

3. **Update Factory**:
   ```typescript
   case 'new-event-slug':
     return dynamic(() => import('./new-event-slug/BadgePreview'));
   ```

4. **Add Database Entry**:
   ```sql
   INSERT INTO public.templates (id, name, description, event_slug) 
   VALUES ('new-event-slug', 'New Event', 'Description', 'new-event-slug');
   
   INSERT INTO public.events (slug, name, template_id) 
   VALUES ('new-event-slug', 'New Event', 'new-event-slug');
   ```

### Modifying Existing Event

1. **Update Component**: Edit the specific event's `BadgePreview.tsx`
2. **Test**: Verify changes in development
3. **Deploy**: Changes are version controlled

## Benefits

### For Developers
- **Type Safety**: Full TypeScript support
- **IDE Support**: Autocomplete and error checking
- **Version Control**: All changes tracked in Git
- **Testing**: Unit tests for each component

### For Designers
- **Consistency**: Each event has a dedicated, stable design
- **Performance**: No database overhead
- **Reliability**: No risk of template corruption

### For Operations
- **Simplicity**: No database migrations for design changes
- **Performance**: Faster rendering (no database queries)
- **Monitoring**: Standard application monitoring applies

## Migration from Dynamic Templates

### What We're Reverting
- Mustache template system
- Database-driven template rendering
- Template service and partials
- Dynamic template API routes

### What We're Keeping
- Event-specific badge designs
- Responsive design patterns
- Asset management structure
- Component architecture principles

## Future Considerations

### When to Consider Dynamic Templates Again
- 50+ events with frequent design changes
- Non-technical users need template editing
- A/B testing requirements for designs
- Complex conditional rendering needs

### Current Approach Limitations
- New events require code deployment
- Designers need developer assistance
- No runtime template editing
- Limited conditional logic per event

## Current Events

### COG Classic 2026
- **Slug**: `cog-classic-2026`
- **Design**: Classic badge with decorative frills and gradient background
- **Theme**: Traditional conference badge design
- **Features**: Frill decorations, social media icons, responsive scaling

### Fall COG 2025
- **Slug**: `fall-cog-2025`
- **Design**: Spooky werewolf-themed badge
- **Theme**: Halloween/autumn with wolf glyph decoration
- **Features**: Wolf glyph overlay, red/black gradient, responsive mobile design
- **Description**: "COG is back with more scandalously spooky fun! We're meeting up with our friends at CCBC in October for Monster Fucking and good times in comforting desert sun."

### Default Event
- **Slug**: `default`
- **Design**: Fallback badge design
- **Theme**: Generic conference badge
- **Features**: Basic layout, social media support, responsive design

## Conclusion

The hardcoded approach provides a **simple, reliable, and performant** solution for event-specific badge designs. While it requires more developer involvement for new events, it eliminates the complexity and potential issues of a dynamic template system.

This architecture is well-suited for:
- Events with stable, well-defined designs
- Teams with developer resources
- Applications prioritizing reliability over flexibility
- Projects with fewer than 20-30 events
