
# Switch Google OAuth to Standard Supabase Flow

Since you've already configured your Google OAuth credentials in the backend's auth settings, the only code change needed is to switch from the Lovable managed wrapper to the standard Supabase auth call. This makes Google sign-in work on any hosting platform (Vercel, Netlify, etc.).

## Changes

### File: `src/pages/Auth.tsx`
- Replace the `handleGoogleSignIn` function to use `supabase.auth.signInWithOAuth` instead of `lovable.auth.signInWithOAuth`
- Set `redirectTo` to `window.location.origin + "/dashboard"` so after Google auth, users land directly on the dashboard
- Remove the `import { lovable }` line (line 4) since it's no longer needed

Current code (line 263-275):
```typescript
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  try {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) throw error;
  } catch (error: any) {
    toast.error(getAuthErrorMessage(error.message));
    setIsLoading(false);
  }
};
```

New code:
```typescript
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
  } catch (error: any) {
    toast.error(getAuthErrorMessage(error.message));
    setIsLoading(false);
  }
};
```

## How It Works After the Change

1. User clicks "Sign in with Google"
2. Browser redirects to Google's consent screen (account picker)
3. After selecting an account, Google redirects to the backend's auth callback
4. The backend processes the token and redirects the user to `https://www.projectpal.site/dashboard`
5. The Supabase client auto-detects session tokens in the URL and signs the user in
6. User lands on the dashboard, fully authenticated

No other files need changes. The `/~oauth/*` route and `OAuthCallback` component become unused but can stay harmlessly.
