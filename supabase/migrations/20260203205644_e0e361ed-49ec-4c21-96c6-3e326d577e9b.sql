-- Create posts table for news/highlights/blogs
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news', 'blog', 'highlight')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to published posts
CREATE POLICY "Anyone can view published posts"
ON public.posts
FOR SELECT
USING (is_published = true);

-- Create policy for admins to view all posts (including drafts)
CREATE POLICY "Admins can view all posts"
ON public.posts
FOR SELECT
USING (is_admin(auth.uid()));

-- Create policy for admins to insert posts
CREATE POLICY "Admins can create posts"
ON public.posts
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Create policy for admins to update posts
CREATE POLICY "Admins can update posts"
ON public.posts
FOR UPDATE
USING (is_admin(auth.uid()));

-- Create policy for admins to delete posts
CREATE POLICY "Admins can delete posts"
ON public.posts
FOR DELETE
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for post cover images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-covers', 'post-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for public read access
CREATE POLICY "Post covers are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-covers');

-- Create storage policy for admin uploads
CREATE POLICY "Admins can upload post covers"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'post-covers' AND is_admin(auth.uid()));

-- Create storage policy for admin updates
CREATE POLICY "Admins can update post covers"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'post-covers' AND is_admin(auth.uid()));

-- Create storage policy for admin deletes
CREATE POLICY "Admins can delete post covers"
ON storage.objects
FOR DELETE
USING (bucket_id = 'post-covers' AND is_admin(auth.uid()));