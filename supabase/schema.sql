-- Badge Maker - Complete Database Schema
-- Run this file for first-time setup of the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE badge_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE social_media_platform AS ENUM ('x', 'bluesky', 'telegram', 'recon', 'furaffinity', 'fetlife', 'discord', 'instagram', 'other');

-- Sessions table for single-session badge creation
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_data JSONB DEFAULT '{}',
  waiver_completed BOOLEAN DEFAULT false,
  waiver_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 hours')
);

-- Waivers table for legal agreements
CREATE TABLE public.waivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  emergency_contact TEXT NOT NULL,
  emergency_phone TEXT NOT NULL,
  
  -- Dietary restrictions and volunteering preferences
  dietary_restrictions TEXT[] DEFAULT '{}',
  dietary_restrictions_other TEXT,
  volunteering_interests TEXT[] DEFAULT '{}',
  additional_notes TEXT,
  
  -- Signature and PDF data
  signature_data JSONB,
  signature_image_url TEXT,
  waiver_version TEXT DEFAULT '1.0.0',
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for waiver_id in sessions
ALTER TABLE public.sessions 
ADD CONSTRAINT fk_sessions_waiver_id 
FOREIGN KEY (waiver_id) REFERENCES public.waivers(id) ON DELETE SET NULL;

-- Templates table
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
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
  cropped_image_url TEXT,
  crop_data JSONB, -- Stores crop coordinates and settings
  -- Social media handles (up to 3)
  social_media_handles JSONB DEFAULT '[]', -- Array of objects with handle and platform
  -- Badge configuration
  badge_data JSONB NOT NULL DEFAULT '{}',
  status badge_status DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE INDEX idx_waivers_session_id ON public.waivers(session_id);
CREATE INDEX idx_waivers_email ON public.waivers(email);
CREATE INDEX idx_waivers_signed_at ON public.waivers(signed_at);
CREATE INDEX idx_waivers_dietary_restrictions ON public.waivers USING GIN(dietary_restrictions);
CREATE INDEX idx_waivers_volunteering_interests ON public.waivers USING GIN(volunteering_interests);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Anyone can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update sessions" ON public.sessions
  FOR UPDATE USING (true);

-- Waivers policies
CREATE POLICY "Anyone can create waivers" ON public.waivers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view waivers" ON public.waivers
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update waivers" ON public.waivers
  FOR UPDATE USING (true);

-- Templates policies
CREATE POLICY "Anyone can view active templates" ON public.templates
  FOR SELECT USING (is_active = true);

-- Badges policies
CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert badges" ON public.badges
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update badges" ON public.badges
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete badges" ON public.badges
  FOR DELETE USING (true);

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

CREATE TRIGGER update_waivers_updated_at BEFORE UPDATE ON public.waivers
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

-- Function to track waiver creation
CREATE OR REPLACE FUNCTION track_waiver_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log waiver creation for analytics
  INSERT INTO public.analytics (session_id, event_type, event_data)
  VALUES (NEW.session_id, 'waiver_created', jsonb_build_object('waiver_id', NEW.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for badge creation tracking
CREATE TRIGGER on_badge_created
  AFTER INSERT ON public.badges
  FOR EACH ROW EXECUTE FUNCTION track_badge_creation();

-- Trigger for waiver creation tracking
CREATE TRIGGER on_waiver_created
  AFTER INSERT ON public.waivers
  FOR EACH ROW EXECUTE FUNCTION track_waiver_creation();

-- Insert single template configuration
INSERT INTO public.templates (id, name, description, config) VALUES
(
  'badge-maker-default',
  'Badge Maker Default',
  'Single template matching Figma design',
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

-- Create storage buckets for images and waiver documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('badge-images', 'badge-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('waiver-documents', 'waiver-documents', false, 10485760, ARRAY['application/pdf']);

-- Set up RLS policies for storage buckets
CREATE POLICY "Allow authenticated uploads to badge-images" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'badge-images');

CREATE POLICY "Allow authenticated updates to badge-images" ON storage.objects FOR UPDATE 
USING (bucket_id = 'badge-images');

CREATE POLICY "Allow authenticated deletes from badge-images" ON storage.objects FOR DELETE 
USING (bucket_id = 'badge-images');

CREATE POLICY "Allow authenticated uploads to waiver-documents" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'waiver-documents');

CREATE POLICY "Allow authenticated updates to waiver-documents" ON storage.objects FOR UPDATE 
USING (bucket_id = 'waiver-documents');

CREATE POLICY "Allow authenticated deletes from waiver-documents" ON storage.objects FOR DELETE 
USING (bucket_id = 'waiver-documents');

-- Note: No public SELECT policies - access will be controlled via signed URLs

-- Verify setup
SELECT 'Badge Maker database setup completed successfully' as status;
