-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE badge_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE template_category AS ENUM ('business', 'conference', 'event', 'custom');
CREATE TYPE social_media_platform AS ENUM ('x', 'bluesky', 'telegram', 'recon', 'furaffinity', 'fetlife', 'discord', 'instagram', 'other');

-- Sessions table for single-session badge creation
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 hours')
);

-- Templates table
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category template_category DEFAULT 'business',
  preview_url TEXT,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  badge_name TEXT NOT NULL, -- Display name for the badge
  email TEXT NOT NULL,
  -- Image storage fields
  original_image_url TEXT,
  original_image_filename TEXT,
  cropped_image_url TEXT,
  cropped_image_filename TEXT,
  crop_data JSONB, -- Stores crop coordinates and settings
     -- Social media handles (up to 3)
   social_media_handles JSONB DEFAULT '[]', -- Array of objects with handle and platform
  -- Badge configuration
  badge_data JSONB NOT NULL DEFAULT '{}',
  status badge_status DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badge categories table (for template organization)
CREATE TABLE public.badge_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badge category assignments
CREATE TABLE public.badge_category_assignments (
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.badge_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (badge_id, category_id)
);



-- Analytics table
CREATE TABLE public.analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_badges_session_id ON public.badges(session_id);
CREATE INDEX idx_badges_status ON public.badges(status);
CREATE INDEX idx_badges_created_at ON public.badges(created_at);
CREATE INDEX idx_templates_active ON public.templates(is_active);
CREATE INDEX idx_analytics_event_type ON public.analytics(event_type);
CREATE INDEX idx_analytics_created_at ON public.analytics(created_at);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Anyone can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update sessions" ON public.sessions
  FOR UPDATE USING (true);

-- Templates policies
CREATE POLICY "Anyone can view active templates" ON public.templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage templates" ON public.templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.email IN ('admin@example.com')
    )
  );

-- Badges policies
CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert badges" ON public.badges
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update badges" ON public.badges
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete badges" ON public.badges
  FOR DELETE USING (true);

-- Badge categories policies
CREATE POLICY "Anyone can view categories" ON public.badge_categories
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert categories" ON public.badge_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update categories" ON public.badge_categories
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete categories" ON public.badge_categories
  FOR DELETE USING (true);

-- Badge category assignments policies
CREATE POLICY "Anyone can manage badge categories" ON public.badge_category_assignments
  FOR ALL USING (true);



-- Analytics policies (more permissive for tracking)
CREATE POLICY "Anyone can insert analytics" ON public.analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view analytics" ON public.analytics
  FOR SELECT USING (true);

-- Create functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_badges_updated_at BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- Function to track badge creation
CREATE OR REPLACE FUNCTION track_badge_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log badge creation for analytics
  INSERT INTO public.analytics (session_id, event_type, event_data)
  VALUES (NEW.session_id, 'badge_created', jsonb_build_object('badge_id', NEW.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for badge creation tracking
CREATE TRIGGER on_badge_created
  AFTER INSERT ON public.badges
  FOR EACH ROW EXECUTE FUNCTION track_badge_creation();

-- Insert single template configuration
INSERT INTO public.templates (id, name, description, category, config) VALUES
(
  'badge-maker-default',
  'Badge Maker Default',
  'Single template matching Figma design',
  'custom',
  '{
    "dimensions": {"width": 3.5, "height": 2.25},
    "layout": {
      "imagePosition": {"x": 0.25, "y": 0.5, "width": 0.4, "height": 0.4, "aspectRatio": 1},
      "textPositions": {
        "badge_name": {"x": 0.7, "y": 0.3, "width": 0.25, "align": "left"},
        "email": {"x": 0.7, "y": 0.5, "width": 0.25, "align": "left"},
        "social_media": {"x": 0.7, "y": 0.7, "width": 0.25, "align": "left"}
      },
      "fonts": {
        "badge_name": "Inter",
        "email": "Inter",
        "social_media": "Inter"
      },
      "colors": {
        "background": "#ffffff",
        "text": "#1f2937",
        "accent": "#3b82f6"
      }
    },
    "imageRequirements": {
      "aspectRatio": 1,
      "minWidth": 300,
      "minHeight": 300,
      "format": "square"
    }
  }'
);
