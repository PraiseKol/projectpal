
-- Add phone_number and university to ambassador_requests
ALTER TABLE public.ambassador_requests
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS university text;

-- Add bank details to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_holder_name text;
