# Atomic Design Structure

This document explains the atomic design pattern implemented in the Badge Maker application.

## Overview

The application now follows the Atomic Design methodology, which breaks down components into five distinct levels:

1. **Atoms** - Basic building blocks
2. **Molecules** - Simple combinations of atoms
3. **Organisms** - Complex combinations of molecules and atoms
4. **Templates** - Page-level layouts
5. **Pages** - Specific instances of templates

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── atoms/             # Basic UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   └── index.ts
│   ├── molecules/         # Simple component combinations
│   │   ├── ImageUpload.tsx
│   │   ├── SocialMediaInput.tsx
│   │   └── index.ts
│   ├── organisms/         # Complex component combinations
│   │   ├── BadgeCreationForm.tsx
│   │   ├── BadgePreview.tsx
│   │   └── index.ts
│   ├── templates/         # Page layouts
│   │   ├── BadgeMakerTemplate.tsx
│   │   └── index.ts
│   ├── pages/            # Specific page instances
│   │   ├── BadgeCreationPage.tsx
│   │   ├── ConfirmationPage.tsx
│   │   └── index.ts
│   └── index.ts          # Main export file
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
└── types/                # TypeScript type definitions
```

## Component Levels

### Atoms
Basic building blocks that can't be broken down further:
- **Button** - Interactive elements
- **Card** - Container components
- **Input** - Form input fields
- **Label** - Text labels
- **Select** - Dropdown selections

### Molecules
Simple combinations of atoms that work together:
- **ImageUpload** - Combines Button, Input, and file handling logic
- **SocialMediaInput** - Combines Select, Input, and Button for social media handles

### Organisms
Complex combinations that form distinct sections:
- **BadgeCreationForm** - Complete form with all input fields and validation
- **BadgePreview** - Live preview of the badge with all information

### Templates
Page-level layouts that define the overall structure:
- **BadgeMakerTemplate** - Common layout with header, main content area, and styling

### Pages
Specific instances of templates with actual content:
- **BadgeCreationPage** - Main badge creation interface
- **ConfirmationPage** - Success confirmation screen

## Import Patterns

### Clean Imports
Use the index files for clean imports:

```typescript
// Import from specific levels
import { Button, Card } from '@/components/atoms'
import { ImageUpload } from '@/components/molecules'
import { BadgeCreationForm } from '@/components/organisms'

// Import from main components index
import { BadgeCreationPage } from '@/components/pages'
```

### Direct Imports
For specific components:

```typescript
import { Button } from '@/components/atoms/button'
import { BadgeCreationForm } from '@/components/organisms/BadgeCreationForm'
```

## Benefits

1. **Scalability** - Easy to add new components at appropriate levels
2. **Reusability** - Components can be reused across different contexts
3. **Maintainability** - Clear separation of concerns
4. **Consistency** - Standardized component structure
5. **Team Collaboration** - Clear guidelines for component placement

## Adding New Components

### Adding an Atom
1. Create the component in `src/components/atoms/`
2. Export it from `src/components/atoms/index.ts`
3. Use it in molecules or organisms

### Adding a Molecule
1. Create the component in `src/components/molecules/`
2. Import atoms as needed
3. Export it from `src/components/molecules/index.ts`
4. Use it in organisms

### Adding an Organism
1. Create the component in `src/components/organisms/`
2. Import atoms and molecules as needed
3. Export it from `src/components/organisms/index.ts`
4. Use it in templates or pages

### Adding a Template
1. Create the component in `src/components/templates/`
2. Define the layout structure
3. Export it from `src/components/templates/index.ts`
4. Use it in pages

### Adding a Page
1. Create the component in `src/components/pages/`
2. Import and use templates, organisms, molecules, and atoms
3. Export it from `src/components/pages/index.ts`
4. Use it in Next.js app router pages

## Migration Notes

- All existing components have been moved to appropriate atomic design levels
- Import paths have been updated throughout the application
- TypeScript configuration updated to reflect new structure
- shadcn/ui configuration updated to use atoms directory
- All functionality remains the same, only structure has changed
