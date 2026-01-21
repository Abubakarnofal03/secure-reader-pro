-- Create content_segments table for storing PDF segment metadata
CREATE TABLE public.content_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique segments per content
  UNIQUE(content_id, segment_index)
);

-- Create index for fast segment lookups
CREATE INDEX idx_content_segments_content_id ON public.content_segments(content_id);
CREATE INDEX idx_content_segments_pages ON public.content_segments(content_id, start_page, end_page);

-- Enable Row Level Security
ALTER TABLE public.content_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view segments if they have access to the parent content
-- Admins can view all segments
CREATE POLICY "Admins can manage all segments"
ON public.content_segments
FOR ALL
USING (is_admin(auth.uid()));

-- Users can view segments if they have access to the parent content
CREATE POLICY "Users can view segments for accessible content"
ON public.content_segments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_content_access uca
    WHERE uca.content_id = content_segments.content_id
    AND uca.user_id = auth.uid()
  )
);

-- Add total_pages column to content table for fast metadata access
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT NULL;