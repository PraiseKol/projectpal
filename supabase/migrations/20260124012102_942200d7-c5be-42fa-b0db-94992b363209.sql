-- PHASE 1: Fix app_settings exposure (CRITICAL)
-- Remove public read access that exposes API keys
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

-- Create restricted policy - only authenticated users can read settings
CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- PHASE 2: Add documents UPDATE policy
CREATE POLICY "Users can update their own documents"
ON public.documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- PHASE 3: Fix transactions INSERT policy
-- Drop the broken policy and create explicit deny for direct user inserts
DROP POLICY IF EXISTS "Edge functions can insert transactions" ON public.transactions;

-- Transactions should only be inserted by service role (edge functions)
-- This explicitly denies direct user inserts while service role bypasses RLS
CREATE POLICY "Deny direct user inserts to transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (false);