-- Part 1: Add price column to content table
ALTER TABLE public.content 
ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Part 2: Create admin_settings table for storing bank details and other settings
CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage all settings
CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
USING (is_admin(auth.uid()));

-- Users can read settings (needed for bank details display)
CREATE POLICY "Users can read settings" 
ON public.admin_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insert default bank details setting
INSERT INTO public.admin_settings (key, value) VALUES ('bank_details', '');

-- Part 3: Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  payment_proof_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, content_id)
);

-- Enable RLS on purchase_requests
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own purchase requests
CREATE POLICY "Users can insert own purchase requests" 
ON public.purchase_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own purchase requests
CREATE POLICY "Users can view own purchase requests" 
ON public.purchase_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all purchase requests
CREATE POLICY "Admins can view all purchase requests" 
ON public.purchase_requests 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Admins can update purchase requests (for approval/rejection)
CREATE POLICY "Admins can update purchase requests" 
ON public.purchase_requests 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Part 4: Create storage bucket for payment proofs (private bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage policies for payment-proofs bucket
-- Users can upload their own payment proofs
CREATE POLICY "Users can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own payment proofs
CREATE POLICY "Users can view own payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all payment proofs
CREATE POLICY "Admins can view all payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs' AND is_admin(auth.uid()));

-- Part 5: Update content RLS policy to allow users to see all active content (for browsing)
DROP POLICY IF EXISTS "Users can view active content they have access to" ON public.content;

CREATE POLICY "Users can view all active content" 
ON public.content 
FOR SELECT 
USING ((is_active = true AND auth.uid() IS NOT NULL) OR is_admin(auth.uid()));

-- Part 6: Add fcm_token column to profiles for push notifications (optional, for later)
ALTER TABLE public.profiles 
ADD COLUMN fcm_token TEXT;