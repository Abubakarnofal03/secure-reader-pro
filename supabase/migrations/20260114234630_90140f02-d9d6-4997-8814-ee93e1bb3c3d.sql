-- Add currency column to content table with default INR
ALTER TABLE public.content ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';