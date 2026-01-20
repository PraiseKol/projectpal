-- Add daily_paraphrase_count column to profiles for tracking free user paraphrase limits
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_paraphrase_count integer DEFAULT 0;