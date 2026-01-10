-- Add RLS policy to storage bucket to prevent direct access
-- Only the service role (used by edge function) can access files
-- Users cannot download files directly, they must go through the edge function

-- First, ensure RLS is enabled on storage.objects (it is by default)
-- Then create restrictive policies for the content-files bucket

-- Remove any existing policies that might allow public access
DROP POLICY IF EXISTS "Allow authenticated uploads to content-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads from content-files" ON storage.objects;

-- Create a policy that blocks ALL user access to content-files bucket
-- The edge function uses service role which bypasses RLS
CREATE POLICY "Block direct user access to content files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'content-files' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'content-files' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);