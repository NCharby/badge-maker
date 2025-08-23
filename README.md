# Badge Maker - Conference Badge Generator

A modern, production-ready Next.js application that allows users to create personalized conference badges with advanced image processing, live preview, and secure storage.

## 🎉 PROJECT STATUS: PRODUCTION READY ✅

**Last Updated**: December 2024  
**Status**: 100% Complete - All features implemented and tested  
**Version**: 1.0.0

---

## ✨ Features

### 🎨 **Badge Creation**
- **Real-time Preview**: Live badge updates as users type
- **Professional Design**: Pixel-perfect Figma design implementation
- **Responsive Layout**: Optimized for desktop and mobile devices
- **Typography System**: Montserrat and Open Sans fonts

### 📸 **Image Processing**
- **Advanced Cropping**: React Advanced Cropper with 1:1 aspect ratio
- **Drag & Drop**: Visual feedback and file validation
- **Image Manipulation**: Rotate, flip, and crop tools
- **File Validation**: Support for PNG, JPG, JPEG, WebP, GIF formats
- **Size Limits**: 5MB maximum, 10KB minimum file sizes
- **Dimension Display**: Shows original pixel dimensions

### 📱 **Social Media Integration**
- **9 Platforms**: X, BlueSky, Telegram, Recon, FurAffinity, FetLife, Discord, Instagram, Other
- **Smart Defaults**: "None" as default platform selection
- **Dynamic Display**: Platform-specific abbreviations in preview
- **Smart UI**: Cancel button only appears for active platforms
- **Up to 3 Handles**: Individual platform selection for each

### 🔗 **External Integration**
- **Query Parameters**: Pre-populate email and name via URL
- **Deep Linking**: Direct access with user information
- **External Apps**: Easy integration with other applications
- **Email Campaigns**: Personalized badge creation links

### 📱 **Mobile Responsiveness**
- **Responsive Scaling**: Badge preview adapts to screen size
- **Touch Optimization**: Proper touch targets and spacing
- **Typography Scaling**: Mobile-optimized text sizing
- **Layout Adaptation**: Single column on mobile, two on desktop

### 🔒 **Security & Storage**
- **Private Storage**: Secure image storage with signed URLs
- **Row Level Security**: Database-level access control
- **Input Validation**: Comprehensive validation on all inputs
- **Error Handling**: Graceful error recovery throughout

---

## 🛠 Tech Stack

### **Frontend**
- **Next.js 14**: App Router, Server Components, API Routes
- **React 18**: Hooks, Context, modern React patterns
- **TypeScript**: Type safety and better development experience
- **Tailwind CSS**: Utility-first styling with custom design system
- **shadcn/ui**: High-quality component library
- **React Hook Form**: Form management with Zod validation
- **Zustand**: Lightweight state management
- **React Advanced Cropper**: Professional image editing

### **Backend**
- **Next.js API Routes**: Server-side logic and endpoints
- **Supabase**: Database, storage, and authentication
- **PostgreSQL**: Relational database with RLS policies
- **Signed URLs**: Secure, temporary image access

### **Development**
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Git**: Version control
- **Atomic Design**: Component architecture methodology

---

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js 18+** 
- **npm or yarn**
- **Supabase account** (for full functionality)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd badge-maker

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment variables
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Supabase Configuration

#### Create Database Schema
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the schema from `supabase/schema.sql`:

```sql
-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create badges table
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  badge_name TEXT NOT NULL,
  email TEXT NOT NULL,
  social_media_handles JSONB NOT NULL,
  original_image_url TEXT,
  cropped_image_url TEXT,
  crop_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics table
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Set Up Storage
1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `badge-images`
3. Set it as **private** (not public)
4. Run the storage policies from `supabase/storage.sql`:

```sql
-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for badge-images bucket
CREATE POLICY "Users can upload images for their session" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'badge-images' AND
    (storage.foldername(name))[1] = current_setting('app.session_id', true)
  );

CREATE POLICY "Users can view images for their session" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'badge-images' AND
    (storage.foldername(name))[1] = current_setting('app.session_id', true)
  );
```

### 4. Start Development Server

```bash
# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Test the Application

1. **Basic Functionality**: Fill out the form and see live preview updates
2. **Image Upload**: Try uploading an image and using the cropper
3. **Social Media**: Add social media handles with different platforms
4. **Query Parameters**: Test pre-population with `?email=test@example.com&name=Test User`
5. **Mobile Responsiveness**: Test on different screen sizes
6. **Complete Flow**: Submit the form and view the confirmation page

---

## 📁 Project Structure

```
badge-maker/
├── src/                          # Source code directory
│   ├── app/                     # Next.js App Router
│   │   ├── api/                # API Routes (7 endpoints)
│   │   ├── confirmation/       # Confirmation page
│   │   ├── test/               # Test page
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # Atomic Design Components
│   │   ├── atoms/             # Basic building blocks (6 components)
│   │   ├── molecules/         # Composite components (3 components)
│   │   ├── organisms/         # Complex components (2 components)
│   │   ├── pages/             # Page-level components (2 components)
│   │   └── templates/         # Layout templates (2 components)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions
│   └── types/                 # TypeScript definitions
├── supabase/                   # Database schema and storage
├── docs/                       # Comprehensive documentation
└── design/                     # Figma assets
```

### Atomic Design Structure

The application follows the Atomic Design methodology:

- **Atoms**: Basic building blocks (Button, Input, Card, etc.) ✅
- **Molecules**: Simple combinations (ImageUpload, SocialMediaInput, ImageCropper) ✅
- **Organisms**: Complex combinations (BadgeCreationForm, BadgePreview) ✅
- **Templates**: Page layouts (BadgeMakerTemplate, ConfirmationTemplate) ✅
- **Pages**: Specific page instances (BadgeCreationPage, ConfirmationPage) ✅

---

## 🎨 Design System

### Colors
- **Primary**: `#ffcc00` (badge background)
- **Background**: `#2d2d2d` (main), `#111111` (cards)
- **Text**: `#ffffff` (white), `#949494` (muted)
- **Borders**: `#5c5c5c` (inputs), `#c0c0c0` (buttons)

### Typography
- **Montserrat**: Headers and labels
- **Open Sans**: Body text and inputs
- **Responsive Sizing**: Mobile-optimized text scaling

### Spacing
- **Form Elements**: Consistent 41px height
- **Gaps**: 5px between form elements, 30px in preview
- **Responsive**: Mobile-optimized spacing

---

## 🔌 API Endpoints

The application includes 7 fully functional API endpoints:

1. **`POST /api/badges`** - Create new badge
2. **`GET /api/badges`** - Retrieve badge by ID or session ID
3. **`POST /api/upload`** - Upload images (original/cropped)
4. **`POST /api/sessions`** - Create new session
5. **`GET /api/sessions`** - Retrieve session data
6. **`GET /api/images/[filename]`** - Generate signed URLs
7. **`GET /api/test`** - Diagnostic endpoint

---

## 🔗 Query Parameter Support

The application supports pre-population via URL parameters:

```
/test?email=user@example.com&name=John%20Doe
/?email=alice@company.com&name=Alice%20Smith
```

**Supported Parameters**:
- `email` - Pre-populates Contact Email field
- `name` - Pre-populates Badge Name field

**Use Cases**:
- External integrations from other applications
- Email campaigns with pre-filled user data
- Deep linking with user information
- A/B testing with different pre-populated data

---

## 📱 Mobile Responsiveness

The application is fully responsive with mobile optimizations:

### BadgePreview Scaling
- **Desktop**: 587px width, 983px height, 400px photo
- **Mobile**: 350px width, auto height, 250px photo
- **Typography**: 48px → 32px for names, 32px → 20px for handles
- **Spacing**: Reduced padding and gaps for mobile

### Form Responsiveness
- **Grid Layout**: Single column on mobile, two columns on desktop
- **Button Sizing**: Consistent 41px height across all elements
- **Touch Targets**: Proper sizing for mobile interaction

---

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Supabase Setup Checklist

- ✅ **Database Schema**: All tables created
- ✅ **Storage Bucket**: `badge-images` bucket configured
- ✅ **RLS Policies**: Row Level Security enabled
- ✅ **API Keys**: Environment variables configured
- ✅ **Storage Policies**: Access control configured

---

## 📚 Documentation

- **[Current Status](docs/CURRENT_STATUS.md)** - Complete project status and features
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Detailed development roadmap
- **[Project Summary](docs/PROJECT_SUMMARY.md)** - High-level project overview
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design
- **[Atomic Design Structure](docs/ATOMIC_DESIGN_STRUCTURE.md)** - Component organization
- **[Image Storage Strategy](docs/IMAGE_STORAGE_STRATEGY.md)** - Image handling approach

---

## 🚀 Deployment

### Production Checklist

- ✅ **Code Quality**: TypeScript, ESLint, Prettier
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Security**: Private storage, input validation
- ✅ **Performance**: Optimized image processing
- ✅ **Documentation**: Complete documentation
- ✅ **Testing**: Manual testing completed

### Deployment Options

1. **Vercel** (Recommended):
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Netlify**:
   ```bash
   npm run build
   # Deploy dist folder
   ```

3. **Self-hosted**:
   ```bash
   npm run build
   npm start
   ```

---

## 🎯 Usage Examples

### Basic Badge Creation
1. Fill out the badge name and email
2. Upload a profile image
3. Crop the image using the advanced cropper
4. Add social media handles (optional)
5. Submit the form
6. View the confirmation page

### External Integration
```javascript
// Pre-populate form via URL
const url = 'https://your-badge-maker.com/test?email=user@company.com&name=John%20Doe';
window.location.href = url;
```

### API Integration
```javascript
// Create badge programmatically
const response = await fetch('/api/badges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    badge_name: 'John Doe',
    email: 'john@example.com',
    social_media_handles: [
      { platform: 'x', handle: '@johndoe' }
    ]
  })
});
```

---

## 🤝 Contributing

This project is production-ready and follows best practices:

- **Atomic Design**: Clean component architecture
- **TypeScript**: Full type safety
- **ESLint/Prettier**: Code quality and formatting
- **Comprehensive Documentation**: Complete project documentation
- **Security First**: Private storage and input validation

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎉 Project Achievement

The Badge Maker application has successfully achieved all initial requirements and is now a fully functional, production-ready web application. The project demonstrates:

- **Complete Feature Set**: All planned features implemented with additional enhancements
- **Professional Quality**: Production-ready code with comprehensive error handling
- **Modern Architecture**: Latest technologies and best practices
- **Mobile-First Design**: Responsive design optimized for all devices
- **Security Focus**: Private storage and comprehensive validation
- **Integration Ready**: Query parameter support for external applications

**Status**: ✅ **100% COMPLETE** - Ready for production deployment  
**Ready for**: Production deployment and user adoption
