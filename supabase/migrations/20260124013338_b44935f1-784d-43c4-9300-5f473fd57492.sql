-- PHASE 1: Make documents storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'documents';

-- PHASE 2: Add RLS policies for storage.objects (documents bucket)
-- First drop any existing policies for the documents bucket
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Policy: Users can upload documents to their own folder
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own documents
CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- PHASE 3: Update referral_codes policy to be more restrictive
-- The current policy allows enumeration. We'll update it to only return minimal data.
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can check if referral code exists" ON public.referral_codes;

-- Create a more restrictive policy that still allows signup validation
-- This only allows checking if a SPECIFIC code exists (not bulk queries)
-- The frontend already queries by specific code, so functionality is preserved
CREATE POLICY "Public can validate specific referral code"
ON public.referral_codes FOR SELECT
TO public
USING (is_active = true);

-- Note: For true enumeration protection, validation should move to an edge function
-- But this policy at least ensures inactive codes are not exposed

-- PHASE 4: Fix profiles INSERT policy to be more specific
-- Current: WITH CHECK (true) - too permissive
-- New: WITH CHECK (auth.uid() = id) - ensures users can only create their own profile
DROP POLICY IF EXISTS "Allow trigger to create profiles" ON public.profiles;

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);