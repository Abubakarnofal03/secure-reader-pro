-- Create user_notes table for page-based notes
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_highlights table for visual highlight overlays
CREATE TABLE public.user_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  x_percent REAL NOT NULL,
  y_percent REAL NOT NULL,
  width_percent REAL NOT NULL,
  height_percent REAL NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_user_notes_user_content ON public.user_notes(user_id, content_id);
CREATE INDEX idx_user_notes_page ON public.user_notes(content_id, page_number);
CREATE INDEX idx_user_highlights_user_content ON public.user_highlights(user_id, content_id);
CREATE INDEX idx_user_highlights_page ON public.user_highlights(content_id, page_number);

-- Enable RLS on both tables
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_notes
CREATE POLICY "Users can view own notes"
ON public.user_notes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
ON public.user_notes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON public.user_notes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.user_notes
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_highlights
CREATE POLICY "Users can view own highlights"
ON public.user_highlights
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
ON public.user_highlights
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
ON public.user_highlights
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on user_notes
CREATE TRIGGER update_user_notes_updated_at
BEFORE UPDATE ON public.user_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();