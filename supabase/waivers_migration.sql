-- Migration to add waivers table with dietary and volunteering data
-- Run this after the main schema.sql

-- Create waivers table
CREATE TABLE IF NOT EXISTS public.waivers (
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

-- Add columns to sessions table for waiver tracking
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS waiver_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waiver_id UUID REFERENCES public.waivers(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waivers_session_id ON public.waivers(session_id);
CREATE INDEX IF NOT EXISTS idx_waivers_email ON public.waivers(email);
CREATE INDEX IF NOT EXISTS idx_waivers_signed_at ON public.waivers(signed_at);
CREATE INDEX IF NOT EXISTS idx_waivers_dietary_restrictions ON public.waivers USING GIN(dietary_restrictions);
CREATE INDEX IF NOT EXISTS idx_waivers_volunteering_interests ON public.waivers USING GIN(volunteering_interests);

-- Enable Row Level Security
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;

-- Waivers policies
CREATE POLICY "Anyone can create waivers" ON public.waivers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view waivers" ON public.waivers
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update waivers" ON public.waivers
  FOR UPDATE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_waivers_updated_at BEFORE UPDATE ON public.waivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Trigger for waiver creation tracking
CREATE TRIGGER on_waiver_created
  AFTER INSERT ON public.waivers
  FOR EACH ROW EXECUTE FUNCTION track_waiver_creation();

-- Verify migration
SELECT 'Waivers migration completed successfully' as status;
