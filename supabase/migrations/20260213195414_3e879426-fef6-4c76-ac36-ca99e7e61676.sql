
-- Create encrypted_content_cache table
CREATE TABLE public.encrypted_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  version_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, device_id)
);

-- Enable RLS
ALTER TABLE public.encrypted_content_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cache entries
CREATE POLICY "Users can view own cache entries"
ON public.encrypted_content_cache FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own cache entries
CREATE POLICY "Users can insert own cache entries"
ON public.encrypted_content_cache FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own cache entries
CREATE POLICY "Users can update own cache entries"
ON public.encrypted_content_cache FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own cache entries
CREATE POLICY "Users can delete own cache entries"
ON public.encrypted_content_cache FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all cache entries
CREATE POLICY "Admins can view all cache entries"
ON public.encrypted_content_cache FOR SELECT
USING (is_admin(auth.uid()));
