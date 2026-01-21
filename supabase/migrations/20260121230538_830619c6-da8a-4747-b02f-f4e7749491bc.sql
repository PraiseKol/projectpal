-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create analysis_sessions table for storing survey/data analysis sessions
CREATE TABLE public.analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text,
  raw_data jsonb DEFAULT '[]'::jsonb,
  column_config jsonb DEFAULT '[]'::jsonb,
  analyses_run jsonb DEFAULT '[]'::jsonb,
  results jsonb DEFAULT '{}'::jsonb,
  credits_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own analysis sessions"
  ON public.analysis_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis sessions"
  ON public.analysis_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis sessions"
  ON public.analysis_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis sessions"
  ON public.analysis_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add monthly analysis count to profiles for free user tracking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS monthly_analysis_count integer DEFAULT 0;

-- Add monthly analysis reset date
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS monthly_analysis_reset_date timestamptz DEFAULT now();

-- Create trigger for updated_at
CREATE TRIGGER update_analysis_sessions_updated_at
  BEFORE UPDATE ON public.analysis_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();