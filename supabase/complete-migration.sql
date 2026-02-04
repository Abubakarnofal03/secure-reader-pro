-- ============================================
-- COMPLETE DATABASE MIGRATION
-- MyCalorics App - Full Schema Setup
-- ============================================
-- Copy and paste this entire file into a new Supabase project's SQL Editor
-- After running, update your FIREBASE_SERVICE_ACCOUNT secret for push notifications
-- ============================================

-- ============================================
-- SECTION 1: HELPER FUNCTIONS (Security Definer)
-- ============================================

-- Function to check if user is admin (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Function to update updated_at column automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- SECTION 2: TABLES
-- ============================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'user',
  has_access boolean NOT NULL DEFAULT false,
  active_device_id text,
  fcm_token text,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Content table (books/publications)
CREATE TABLE public.content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  cover_url text,
  category text DEFAULT 'general',
  price numeric NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'INR',
  total_pages integer,
  table_of_contents jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Content segments table (for segmented PDF loading)
CREATE TABLE public.content_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  start_page integer NOT NULL,
  end_page integer NOT NULL,
  file_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Posts table (news/highlights/blogs)
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text,
  cover_image_url text,
  category text NOT NULL DEFAULT 'news',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  author_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User content access table (tracks which users have access to which content)
CREATE TABLE public.user_content_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Purchase requests table (payment proof submissions)
CREATE TABLE public.purchase_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  payment_proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Reading progress table
CREATE TABLE public.reading_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1,
  total_pages integer,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- User highlights table
CREATE TABLE public.user_highlights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  x_percent real NOT NULL,
  y_percent real NOT NULL,
  width_percent real NOT NULL,
  height_percent real NOT NULL,
  color text NOT NULL DEFAULT 'yellow',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User notes table
CREATE TABLE public.user_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  note_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Admin settings table
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- SECTION 3: INDEXES
-- ============================================

CREATE INDEX idx_content_segments_content_id ON public.content_segments(content_id);
CREATE INDEX idx_content_segments_segment_index ON public.content_segments(segment_index);
CREATE INDEX idx_user_content_access_user_id ON public.user_content_access(user_id);
CREATE INDEX idx_user_content_access_content_id ON public.user_content_access(content_id);
CREATE INDEX idx_purchase_requests_user_id ON public.purchase_requests(user_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX idx_reading_progress_user_content ON public.reading_progress(user_id, content_id);
CREATE INDEX idx_user_highlights_user_content ON public.user_highlights(user_id, content_id);
CREATE INDEX idx_user_notes_user_content ON public.user_notes(user_id, content_id);
CREATE INDEX idx_posts_published ON public.posts(is_published, published_at DESC);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_fcm_token ON public.profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- ============================================
-- SECTION 4: TRIGGERS
-- ============================================

-- Auto-update updated_at for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for content
CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for posts
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for user_notes
CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SECTION 5: AUTH TRIGGER (Create profile on signup)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, has_access)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user',
    true  -- Instant access for new users
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SECTION 6: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 7: RLS POLICIES - PROFILES
-- ============================================

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 8: RLS POLICIES - CONTENT
-- ============================================

CREATE POLICY "Users can view all active content"
  ON public.content FOR SELECT
  USING (((is_active = true) AND (auth.uid() IS NOT NULL)) OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage all content"
  ON public.content FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 9: RLS POLICIES - CONTENT SEGMENTS
-- ============================================

CREATE POLICY "Users can view segments for accessible content"
  ON public.content_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_content_access uca
    WHERE uca.content_id = content_segments.content_id
    AND uca.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all segments"
  ON public.content_segments FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 10: RLS POLICIES - POSTS
-- ============================================

CREATE POLICY "Anyone can view published posts"
  ON public.posts FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all posts"
  ON public.posts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update posts"
  ON public.posts FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete posts"
  ON public.posts FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 11: RLS POLICIES - USER CONTENT ACCESS
-- ============================================

CREATE POLICY "Users can view their own content access"
  ON public.user_content_access FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all content access"
  ON public.user_content_access FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 12: RLS POLICIES - PURCHASE REQUESTS
-- ============================================

CREATE POLICY "Users can view own purchase requests"
  ON public.purchase_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase requests"
  ON public.purchase_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchase requests"
  ON public.purchase_requests FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update purchase requests"
  ON public.purchase_requests FOR UPDATE
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 13: RLS POLICIES - READING PROGRESS
-- ============================================

CREATE POLICY "Users can view own reading progress"
  ON public.reading_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reading progress"
  ON public.reading_progress FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert own reading progress"
  ON public.reading_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading progress"
  ON public.reading_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading progress"
  ON public.reading_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SECTION 14: RLS POLICIES - USER HIGHLIGHTS
-- ============================================

CREATE POLICY "Users can view own highlights"
  ON public.user_highlights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON public.user_highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON public.user_highlights FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SECTION 15: RLS POLICIES - USER NOTES
-- ============================================

CREATE POLICY "Users can view own notes"
  ON public.user_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.user_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.user_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SECTION 16: RLS POLICIES - ADMIN SETTINGS
-- ============================================

CREATE POLICY "Users can read settings"
  ON public.admin_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage settings"
  ON public.admin_settings FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 17: STORAGE BUCKETS
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('content-files', 'content-files', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('content-covers', 'content-covers', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('post-covers', 'post-covers', true);

-- ============================================
-- SECTION 18: STORAGE POLICIES - CONTENT FILES (Private)
-- ============================================

CREATE POLICY "Admins can upload content files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-files' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update content files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-files' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete content files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-files' AND is_admin(auth.uid()));

CREATE POLICY "Admins can view all content files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-files' AND is_admin(auth.uid()));

-- ============================================
-- SECTION 19: STORAGE POLICIES - CONTENT COVERS (Public)
-- ============================================

CREATE POLICY "Anyone can view content covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-covers');

CREATE POLICY "Admins can upload content covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-covers' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update content covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-covers' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete content covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-covers' AND is_admin(auth.uid()));

-- ============================================
-- SECTION 20: STORAGE POLICIES - PAYMENT PROOFS (Private)
-- ============================================

CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND is_admin(auth.uid()));

-- ============================================
-- SECTION 21: STORAGE POLICIES - POST COVERS (Public)
-- ============================================

CREATE POLICY "Anyone can view post covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-covers');

CREATE POLICY "Admins can upload post covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-covers' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update post covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'post-covers' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete post covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-covers' AND is_admin(auth.uid()));

-- ============================================
-- SECTION 22: INITIAL DATA (Optional)
-- ============================================

-- Insert default admin settings
INSERT INTO public.admin_settings (key, value) VALUES 
  ('upi_id', 'your-upi-id@upi'),
  ('payment_instructions', 'Please pay using UPI and upload the screenshot as proof.')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SECTION 23: GRANT PERMISSIONS
-- ============================================

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant access to sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
-- 
-- NEXT STEPS:
-- 1. Create your first admin user by signing up, then run:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
--
-- 2. Add FIREBASE_SERVICE_ACCOUNT secret in Supabase Dashboard > Settings > Secrets
--    for push notifications to work
--
-- 3. Deploy edge functions from your codebase
--
-- ============================================
