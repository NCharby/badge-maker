# Badge Maker 🏷️

A modern, production-ready web application for creating professional conference badges with live previews, digital waiver signing, and multi-event support.

## ✨ **Features**

- 🎨 **Live Badge Preview** - Real-time updates as you type
- 📝 **Digital Waiver Signing** - Legally binding signatures with PDF generation
- 🎯 **Multi-Event Support** - Separate events with unique configurations
- 📱 **Mobile Responsive** - Optimized for all devices
- 🔒 **Secure & Compliant** - Row Level Security and audit trails
- 📧 **Email Integration** - Automated PDF delivery via Postmark
- 🤖 **Telegram Integration** - Automatic invite links for community groups
- 🖼️ **Advanced Image Processing** - Upload, crop, and optimize photos
- 🌐 **Social Media Integration** - Support for multiple platforms

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Supabase account
- Postmark account (for email delivery)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd badge-maker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   POSTMARK_API_KEY=your_postmark_api_key
   POSTMARK_FROM_EMAIL=noreply@yourdomain.com
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the schema from `supabase/schema.sql`
   - Configure storage buckets and RLS policies

5. **Configure Telegram (Optional)**
   - Create a Telegram bot via @BotFather
   - Add your bot token to `.env.local`
   - Configure event-specific Telegram settings in the database:
   ```sql
   UPDATE public.events 
   SET telegram_config = '{
     "enabled": true,
     "privateGroupId": "your_group_id",
     "groupName": "Your Event Group",
     "description": "Join our community for updates"
   }'
   WHERE slug = 'default';
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   ```
   http://localhost:3000/default/landing
   ```

## 🏗️ **Architecture**

### **Tech Stack**
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase, PostgreSQL
- **State Management**: Zustand with persistence
- **Forms**: React Hook Form + Zod validation
- **PDF Generation**: Puppeteer
- **Email**: Postmark
- **Telegram**: Bot API with automatic invite generation
- **Storage**: Supabase Storage with RLS

### **Component Structure**
```
src/
├── app/                    # Next.js App Router
│   ├── [event-name]/      # Dynamic event routes
│   └── api/               # API endpoints
├── components/             # Atomic Design components
│   ├── atoms/             # Basic UI elements
│   ├── molecules/          # Compound components
│   ├── organisms/          # Complex components
│   └── pages/             # Page-level components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── types/                  # TypeScript definitions
```

## 📊 **Database Schema**

The application uses a relational database with the following core tables:

- **`events`** - Event information and metadata
- **`templates`** - Badge template configurations
- **`sessions`** - User session tracking
- **`waivers`** - Signed waiver documents
- **`badges`** - Created badge records
- **`analytics`** - Usage and performance metrics
- **`telegram_invites`** - Telegram group invite links

## 🔄 **User Flow**

1. **Landing Page** → User information and preferences
2. **Waiver Signing** → Digital signature and legal agreement
3. **Badge Creation** → Photo upload and customization
4. **Confirmation** → Summary and download options

## 🚀 **Deployment**

### **Vercel (Recommended)**
1. Connect your repository to Vercel
2. Set environment variables
3. Deploy automatically on push

### **Self-Hosted**
1. Build the application: `npm run build`
2. Start the production server: `npm start`
3. Configure your reverse proxy (nginx, Apache)

## 🧪 **Testing**

The application includes comprehensive error handling and validation:

- **Form Validation**: Client and server-side validation
- **Error Boundaries**: React error boundary for component errors
- **API Error Handling**: Graceful error handling with retry options
- **User Support**: Integrated error reporting and support contact

## 📚 **Documentation**

- [**Current Status**](docs/CURRENT_STATUS.md) - Project overview and completed features
- [**Architecture**](docs/ARCHITECTURE.md) - System design and technical details
- [**Project Summary**](docs/PROJECT_SUMMARY.md) - Feature overview and roadmap

## 🤝 **Contributing**

This project is production-ready and maintained. For new features or improvements:

1. Create a feature branch
2. Implement changes with proper testing
3. Update documentation
4. Submit a pull request

## 📄 **License**

This project is proprietary software. All rights reserved.

## 🆘 **Support**

For technical support or questions:
- **Email**: hello@shinydogproductions.com
- **Error Reports**: Include error IDs from the application

---

**Status**: ✅ Production Ready  
**Version**: 2.1.0 (With Telegram Integration)  
**Last Updated**: December 2024
