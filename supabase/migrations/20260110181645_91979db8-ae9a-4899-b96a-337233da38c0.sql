-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all content" ON public.content;
DROP POLICY IF EXISTS "Users can view active content they have access to" ON public.content;
DROP POLICY IF EXISTS "Admins can manage all content access" ON public.user_content_access;
DROP POLICY IF EXISTS "Users can view their own content access" ON public.user_content_access;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Fix profiles table policies (PERMISSIVE)
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all profiles (using security definer function)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Fix content table policies
CREATE POLICY "Admins can manage all content"
ON public.content
FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view active content they have access to"
ON public.content
FOR SELECT
USING (
  is_active = true AND (
    EXISTS (
      SELECT 1 FROM user_content_access
      WHERE user_content_access.content_id = content.id
      AND user_content_access.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
);

-- Fix user_content_access table policies
CREATE POLICY "Admins can manage all content access"
ON public.user_content_access
FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own content access"
ON public.user_content_access
FOR SELECT
USING (user_id = auth.uid());