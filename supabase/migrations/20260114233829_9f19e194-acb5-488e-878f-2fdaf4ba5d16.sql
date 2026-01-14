-- Add cover_url column to content table
ALTER TABLE public.content ADD COLUMN cover_url TEXT;

-- Create storage bucket for content covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-covers', 'content-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to view covers (public bucket)
CREATE POLICY "Anyone can view covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-covers');

-- Allow admins to upload covers
CREATE POLICY "Admins can upload covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'content-covers' AND public.is_admin(auth.uid()));

-- Allow admins to update covers
CREATE POLICY "Admins can update covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'content-covers' AND public.is_admin(auth.uid()));

-- Allow admins to delete covers
CREATE POLICY "Admins can delete covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'content-covers' AND public.is_admin(auth.uid()));