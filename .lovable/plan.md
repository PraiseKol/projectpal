
# Fix Google OAuth "Completing Sign In" Infinite Spinner

## Root Cause

The `@lovable.dev/cloud-auth-js` library has two distinct flows:

- **In iframe (Lovable preview)**: Uses a popup window. Tokens come back via `postMessage`. The `signInWithOAuth()` call stays alive, receives tokens, and calls `supabase.auth.setSession()`. This works.

- **Standalone tab / published URL**: Does a **full page redirect** to `/~oauth/initiate`. The browser navigates away completely. After Google auth, the broker redirects back to a `/~oauth/*` path with tokens in the URL. But the original `signInWithOAuth()` call is gone (the page was reloaded). **Nobody extracts the tokens from the URL or calls `setSession()`.**

The `OAuthCallback` component listens for `SIGNED_IN` auth events, but that event never fires because the tokens sitting in the URL are never processed into a Supabase session.

## Fix

### File: `src/components/OAuthCallback.tsx`

Update the component to:

1. On mount, check the URL for `access_token` and `refresh_token` in both hash fragments and query parameters
2. If tokens are found, call `supabase.auth.setSession()` to establish the session
3. Keep the existing `getSession()` check and `onAuthStateChange` listener as fallbacks
4. Add detailed console logs for every step of the process
5. Keep the 15-second timeout safety net

The key new logic:

```
// Extract tokens from URL hash or query params
const hash = window.location.hash.substring(1);
const hashParams = new URLSearchParams(hash);
const queryParams = new URLSearchParams(window.location.search);

const access_token = hashParams.get("access_token") || queryParams.get("access_token");
const refresh_token = hashParams.get("refresh_token") || queryParams.get("refresh_token");

if (access_token && refresh_token) {
  // Process the tokens into a session
  supabase.auth.setSession({ access_token, refresh_token });
}
```

### No other files need changes

- `src/App.tsx` already has the `/~oauth/*` route
- `src/integrations/lovable/index.ts` handles the iframe/popup flow correctly
- `src/pages/Auth.tsx` handles `SIGNED_IN` events correctly for the popup flow

## Technical Details

### Full Updated Component Logic

1. **Mount**: Log the current URL and all its parts (hash, search params)
2. **Token extraction**: Parse both URL hash and query params for `access_token` and `refresh_token`
3. **Session setup**: If tokens found, call `supabase.auth.setSession()` which will trigger `SIGNED_IN`
4. **Existing session check**: `supabase.auth.getSession()` as fallback
5. **Auth listener**: `onAuthStateChange` catches `SIGNED_IN` and navigates to `/dashboard`
6. **Timeout**: 15 seconds, then redirect to `/auth` with error toast

### Files to Modify
- `src/components/OAuthCallback.tsx` -- add token extraction from URL and `setSession` call
