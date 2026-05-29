
-- 1. Referral credit rewards table
CREATE TABLE public.referral_credit_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN ('signup','first_purchase')),
  credits_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_user_id, referred_user_id, trigger_event)
);
GRANT SELECT ON public.referral_credit_rewards TO authenticated;
GRANT ALL ON public.referral_credit_rewards TO service_role;
ALTER TABLE public.referral_credit_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own referral rewards"
  ON public.referral_credit_rewards FOR SELECT
  USING (referrer_user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 2. Blog posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  author text DEFAULT 'ProjectPal Team',
  meta_description text,
  keywords text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published posts"
  ON public.blog_posts FOR SELECT USING (published = true);
CREATE POLICY "Admins read all posts"
  ON public.blog_posts FOR SELECT
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins manage posts insert"
  ON public.blog_posts FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins manage posts update"
  ON public.blog_posts FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins manage posts delete"
  ON public.blog_posts FOR DELETE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_blog_posts_updated
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Project topics
CREATE TABLE public.project_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  department_name text NOT NULL,
  topic text NOT NULL,
  level text DEFAULT 'undergrad',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_topics_dept ON public.project_topics(department);
GRANT SELECT ON public.project_topics TO anon, authenticated;
GRANT ALL ON public.project_topics TO service_role;
ALTER TABLE public.project_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads topics"
  ON public.project_topics FOR SELECT USING (true);
CREATE POLICY "Admins write topics insert"
  ON public.project_topics FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins write topics update"
  ON public.project_topics FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins write topics delete"
  ON public.project_topics FOR DELETE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 4. Pro free trial columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_free_ppt_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS monthly_free_analysis_used_at timestamptz;

-- 5. email_logs add email_type for lifecycle
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS email_type text;

-- 6. Update handle_new_user: also create a personal referral code for every new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text;
  ambassador_id uuid;
  v_default_daily int;
  v_default_monthly int;
  v_personal_code text;
BEGIN
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'default_daily_credits'), 8) INTO v_default_daily;
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'default_monthly_credits'), 40) INTO v_default_monthly;

  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND ref_code <> '' THEN
    SELECT user_id INTO ambassador_id
    FROM public.referral_codes
    WHERE code = UPPER(ref_code) AND is_active = true;
  END IF;

  INSERT INTO public.profiles (
    id, plan_type, monthly_credits, daily_credits,
    daily_reset_date, paid_credits, first_name, last_name, referred_by
  )
  VALUES (
    NEW.id, 'free', v_default_monthly, v_default_daily, CURRENT_DATE, 0,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',''),' ',1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name',
      nullif(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',''),' ',2),'')),
    ambassador_id
  );

  IF ambassador_id IS NOT NULL THEN
    INSERT INTO public.referrals (ambassador_user_id, referred_user_id, referral_code_used)
    VALUES (ambassador_id, NEW.id, UPPER(ref_code));
  END IF;

  -- Auto-create a personal referral code for EVERY new user
  v_personal_code := 'PAL' || UPPER(SUBSTRING(REPLACE(NEW.id::text,'-',''),1,7));
  INSERT INTO public.referral_codes (user_id, code, is_active)
  VALUES (NEW.id, v_personal_code, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 7. Backfill: create personal referral codes for all existing users that don't have one
INSERT INTO public.referral_codes (user_id, code, is_active)
SELECT p.id, 'PAL' || UPPER(SUBSTRING(REPLACE(p.id::text,'-',''),1,7)), true
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.id
WHERE rc.id IS NULL
ON CONFLICT DO NOTHING;

-- 8. Seed app_settings keys for referral bonuses
INSERT INTO public.app_settings (key, value)
VALUES
  ('referral_signup_bonus_credits','20'),
  ('referral_purchase_bonus_credits','100')
ON CONFLICT (key) DO NOTHING;
