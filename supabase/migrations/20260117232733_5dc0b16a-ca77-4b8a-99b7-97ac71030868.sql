-- Add first_name and last_name columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Update handle_new_user function to copy names from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, plan_type, monthly_credits, daily_credits, daily_reset_date, paid_credits, first_name, last_name)
  VALUES (
    NEW.id,
    'free',
    40,
    8,
    CURRENT_DATE,
    0,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$function$;