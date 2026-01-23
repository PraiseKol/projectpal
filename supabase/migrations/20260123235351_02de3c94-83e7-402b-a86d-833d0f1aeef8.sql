-- Update handle_new_user function to process referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ref_code text;
  ambassador_id uuid;
BEGIN
  -- Extract referral code from user metadata
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  
  -- Look up ambassador if referral code is provided
  IF ref_code IS NOT NULL AND ref_code <> '' THEN
    SELECT user_id INTO ambassador_id
    FROM public.referral_codes
    WHERE code = UPPER(ref_code) AND is_active = true;
  END IF;

  -- Insert profile with referred_by set if valid referral
  INSERT INTO public.profiles (
    id, plan_type, monthly_credits, daily_credits, 
    daily_reset_date, paid_credits, first_name, last_name, referred_by
  )
  VALUES (
    NEW.id,
    'free',
    40,
    8,
    CURRENT_DATE,
    0,
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'given_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'family_name',
      nullif(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 2), '')
    ),
    ambassador_id
  );

  -- Create referral record if valid ambassador was found
  IF ambassador_id IS NOT NULL THEN
    INSERT INTO public.referrals (ambassador_user_id, referred_user_id, referral_code_used)
    VALUES (ambassador_id, NEW.id, UPPER(ref_code));
  END IF;

  RETURN NEW;
END;
$$;

-- Add RLS policy to allow public to check referral codes during signup (code only, no user data)
CREATE POLICY "Anyone can check if referral code exists"
ON public.referral_codes
FOR SELECT
USING (is_active = true);