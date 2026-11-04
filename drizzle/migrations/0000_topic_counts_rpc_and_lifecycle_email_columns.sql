-- Server-side aggregate counts for /topics landing page (replaces 1000-row client fetch)
CREATE OR REPLACE FUNCTION public.get_topic_department_counts()
RETURNS TABLE (department text, department_name text, topic_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.department, t.department_name, count(*)::bigint
  FROM public.project_topics t
  GROUP BY t.department, t.department_name
  ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_topic_department_counts() TO anon, authenticated;

-- Lifecycle email tracking (one-time/periodic welcome, inactivity check-in, low-credit alerts)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivity_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS low_credit_email_sent_at timestamptz;
