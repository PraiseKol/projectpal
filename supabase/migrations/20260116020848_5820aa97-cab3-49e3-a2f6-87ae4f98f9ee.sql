-- Fix profiles table: Allow the handle_new_user trigger to insert profiles
-- The trigger runs with SECURITY DEFINER so we need to allow inserts from the trigger
CREATE POLICY "Allow trigger to create profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);

-- Fix transactions table: Remove overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert transactions" ON public.transactions;

-- Create a more restrictive policy - only service role (via edge functions) can insert
-- Since edge functions use service role key, we use a function check
CREATE POLICY "Edge functions can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  -- This allows inserts when called from edge functions with service role
  -- The service role bypasses RLS, so this policy is for anon/authenticated users
  -- We deny all direct inserts from client
  false
);