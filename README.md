# Badge Maker - Conference Badge Generator

A NextJS application with Supabase integration that allows users to create custom conference badges with live preview functionality.

## 🎯 Features

- **Live Badge Preview**: Real-time preview of badge design as users input information
- **Image Upload & Cropping**: Advanced image cropping using React Advanced Cropper
- **Single Template**: Fixed template matching Figma design
- **Instant Access**: No registration required, start creating badges immediately
- **Single Session**: Complete badge creation in one session
- **Social Media Integration**: Support for 9 social media platforms
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Components**: shadcn/ui components
- **Image Processing**: React Advanced Cropper
- **Backend**: Supabase (Database, Storage)
- **Styling**: Tailwind CSS
- **State Management**: React Hook Form, Zustand
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd badge-maker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your Supabase credentials in `.env.local`

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
badge-maker/
├── src/                   # Source code directory
│   ├── app/              # Next.js app directory
│   │   ├── page.tsx      # Badge creation interface
│   │   ├── confirmation/ # Confirmation screen
│   │   └── api/          # API routes
│   ├── components/       # Atomic design components
│   │   ├── atoms/        # Basic UI components (shadcn/ui)
│   │   ├── molecules/    # Simple component combinations
│   │   ├── organisms/    # Complex component combinations
│   │   ├── templates/    # Page-level layouts
│   │   └── pages/        # Specific page instances
│   ├── lib/              # Utility functions
│   │   ├── supabase.ts   # Supabase client
│   │   └── utils.ts      # General utilities
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript type definitions
├── docs/                 # Documentation
├── supabase/             # Supabase configuration
└── design/               # Design assets
```

### Atomic Design Structure

The application follows the Atomic Design methodology:

- **Atoms**: Basic building blocks (Button, Input, Card, etc.)
- **Molecules**: Simple combinations (ImageUpload, SocialMediaInput)
- **Organisms**: Complex combinations (BadgeCreationForm, BadgePreview)
- **Templates**: Page layouts (BadgeMakerTemplate)
- **Pages**: Specific page instances (BadgeCreationPage, ConfirmationPage)

## 🎨 Design System

The application uses shadcn/ui components for consistent design and React Advanced Cropper for image manipulation. The badge templates follow a modular design system that allows for easy customization and extension.

## 📱 Screens

1. **Badge Maker Empty**: Default state with form inputs and empty preview
2. **Badge Maker Crop Overlay**: Modal with React Advanced Cropper for image editing
3. **Badge Maker Filled**: Completed state with filled information and preview

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup

1. Create a new Supabase project
2. Set up the database schema (see `supabase/schema.sql`)
3. Configure storage buckets for badge images
4. Set up API routes for badge generation

## 📄 License

MIT License - see LICENSE file for details
