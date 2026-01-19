-- Update handle_new_user to set has_access = true by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, has_access)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user',
    true  -- Changed from false to true - instant access for new users
  );
  RETURN NEW;
END;
$function$;

-- Add category column to content table for topic icons
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';