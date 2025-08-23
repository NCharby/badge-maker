# Segment 1: Project Foundation & Setup

## 🎯 Overview
Set up the Next.js project with all dependencies, configuration files, and basic project structure.

## 📋 Tasks

### Task 1.1: Initialize Next.js Project
**Duration**: 15 minutes

1. **Create Next.js App**
   ```bash
   npx create-next-app@latest badge-maker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   cd badge-maker
   ```

2. **Install Additional Dependencies**
   ```bash
   npm install @supabase/supabase-js react-hook-form @hookform/resolvers zod zustand lucide-react react-advanced-cropper
   ```

3. **Install Development Dependencies**
   ```bash
   npm install -D @types/node @types/react @types/react-dom
   ```

### Task 1.2: Set Up shadcn/ui
**Duration**: 10 minutes

1. **Initialize shadcn/ui**
   ```bash
   npx shadcn@latest init
   ```
   - Choose "Yes" for TypeScript
   - Choose "Yes" for CSS variables
   - Choose "Yes" for React Server Components
   - Choose "Yes" for components.json
   - Choose "Yes" for tailwind.config.js
   - Choose "Yes" for globals.css

2. **Install Core Components**
   ```bash
   npx shadcn@latest add button input label card form textarea select
   ```

### Task 1.3: Configure Environment Variables
**Duration**: 5 minutes

1. **Create `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. **Replace with your actual Supabase credentials**

### Task 1.4: Set Up Project Structure
**Duration**: 10 minutes

1. **Create Directory Structure**
   ```bash
   mkdir -p src/lib/utils
   mkdir -p src/components/ui
   mkdir -p src/hooks
   mkdir -p src/types
   mkdir -p src/app/api
   mkdir -p src/app/confirmation
   ```

2. **Create Basic Files**
   ```bash
   touch src/lib/supabase.ts
   touch src/types/badge.ts
   touch src/hooks/useBadgeStore.ts
   ```

### Task 1.5: Configure Supabase Client
**Duration**: 5 minutes

1. **Create `src/lib/supabase.ts`**
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

### Task 1.6: Set Up Basic Types
**Duration**: 10 minutes

1. **Create `src/types/badge.ts`**
   ```typescript
   export interface SocialMediaHandle {
     platform: 'x' | 'bluesky' | 'telegram' | 'recon' | 'furaffinity' | 'fetlife' | 'discord' | 'instagram' | 'other';
     handle: string;
   }

   export interface BadgeData {
     badge_name: string;
     email: string;
     social_media_handles: SocialMediaHandle[];
     photo?: File;
   }

   export interface CropData {
     x: number;
     y: number;
     width: number;
     height: number;
     aspectRatio: 1;
     minWidth: 300;
     minHeight: 300;
     flipHorizontal?: boolean;
     flipVertical?: boolean;
   }
   ```

### Task 1.7: Set Up Zustand Store
**Duration**: 10 minutes

1. **Create `src/hooks/useBadgeStore.ts`**
   ```typescript
   import { create } from 'zustand'
   import { BadgeData, CropData } from '@/types/badge'

   interface BadgeStore {
     data: BadgeData;
     cropData?: CropData;
     originalImage?: File;
     croppedImage?: Blob;
     setData: (data: Partial<BadgeData>) => void;
     setCropData: (cropData: CropData) => void;
     setOriginalImage: (file: File) => void;
     setCroppedImage: (blob: Blob) => void;
     reset: () => void;
   }

   export const useBadgeStore = create<BadgeStore>((set) => ({
     data: {
       badge_name: '',
       email: '',
       social_media_handles: []
     },
     setData: (newData) => set((state) => ({ 
       data: { ...state.data, ...newData } 
     })),
     setCropData: (cropData) => set({ cropData }),
     setOriginalImage: (file) => set({ originalImage: file }),
     setCroppedImage: (blob) => set({ croppedImage: blob }),
     reset: () => set({
       data: { badge_name: '', email: '', social_media_handles: [] },
       cropData: undefined,
       originalImage: undefined,
       croppedImage: undefined
     })
   }))
   ```

## ✅ Verification Checklist

- [ ] Next.js project created with TypeScript and Tailwind
- [ ] All dependencies installed
- [ ] shadcn/ui initialized and core components added
- [ ] Environment variables configured
- [ ] Project structure created
- [ ] Supabase client configured
- [ ] Basic types defined
- [ ] Zustand store set up
- [ ] Project runs without errors (`npm run dev`)

## 🎯 Deliverables

1. **Working Next.js application** with all dependencies
2. **Configured shadcn/ui** with core components
3. **Supabase client** ready for use
4. **Type definitions** for badge data
5. **State management** with Zustand
6. **Project structure** ready for development

## 🚀 Ready for Next Segment

Once Segment 1 is complete, we'll move to **Segment 2: Core UI Components** where we'll build the badge creation interface.

## 🆘 Troubleshooting

### Common Issues

1. **shadcn/ui init fails**
   - Ensure you're in the project root
   - Try running with `--yes` flag for automatic answers

2. **Environment variables not working**
   - Restart the development server
   - Check for typos in `.env.local`

3. **TypeScript errors**
   - Run `npm run build` to check for type issues
   - Ensure all imports are correct

### Getting Help
- Next.js Documentation: [https://nextjs.org/docs](https://nextjs.org/docs)
- shadcn/ui Documentation: [https://ui.shadcn.com/](https://ui.shadcn.com/)
- Supabase Documentation: [https://supabase.com/docs](https://supabase.com/docs)
