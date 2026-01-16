-- Add billing_period and duration_days columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN billing_period text DEFAULT 'monthly',
ADD COLUMN duration_days integer DEFAULT 30;