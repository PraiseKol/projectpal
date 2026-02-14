

# Fix: Authentication Redirect to Old Domain

## Problem
After signing in (Google or email), users are redirected to `https://scholar-ai-snowy.vercel.app/dashboard` instead of the current domain `https://projectpal.site`. This happens because the authentication Site URL is still configured to the old Vercel domain.

## Solution

### 1. Update Authentication Site URL
Update the Site URL in the authentication settings from the old Vercel domain to `https://projectpal.site`. This controls where email confirmation links and OAuth redirects point to.

### 2. Update Redirect URLs
Add `https://projectpal.site` as an allowed redirect URL in the authentication settings so that OAuth flows and email links redirect correctly.

### 3. Migrate Google OAuth to Lovable Cloud Auth
Update `src/pages/Auth.tsx` to use the Lovable Cloud managed auth for Google sign-in instead of calling the database auth client directly. This ensures proper OAuth handling through Lovable Cloud.

## Technical Details

**File: `src/pages/Auth.tsx`**

- Import the Lovable Cloud auth module
- Replace `supabase.auth.signInWithOAuth({ provider: "google", ... })` with `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- The `emailRedirectTo` values in `signUp` and `resend` already use `window.location.origin`, which is correct

**Auth Configuration Changes (via configure-auth tool):**
- Set Site URL to `https://projectpal.site`
- Add `https://projectpal.site/**` as a redirect URL

