-- Create reading_progress table for storing user reading positions
CREATE TABLE public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1,
  total_pages integer,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

-- Users can manage their own reading progress
CREATE POLICY "Users can view own reading progress"
ON public.reading_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading progress"
ON public.reading_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading progress"
ON public.reading_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading progress"
ON public.reading_progress FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all reading progress for analytics
CREATE POLICY "Admins can view all reading progress"
ON public.reading_progress FOR SELECT
USING (public.is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_reading_progress_user_content ON public.reading_progress(user_id, content_id);