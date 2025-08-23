-- Create single storage bucket for all images (private for security)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('badge-images', 'badge-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- Set up RLS policies for the storage bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'badge-images');

CREATE POLICY "Allow authenticated updates" ON storage.objects FOR UPDATE 
USING (bucket_id = 'badge-images');

CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE 
USING (bucket_id = 'badge-images');

-- Note: No public SELECT policy - access will be controlled via signed URLs
