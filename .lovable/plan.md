

# Fix Password Reset Redirect and Google OAuth "Page Not Found"

## Root Cause Analysis

### Issue 1: Password Reset Goes to Dashboard
When a user clicks the reset password link in their email, the authentication system processes the recovery token and creates a session. The user lands on the site root (`/`), where `Index.tsx` detects the session via `getUser()` and immediately redirects to `/dashboard`. The `PASSWORD_RECOVERY` event fires on `onAuthStateChange`, but only `Auth.tsx` and `ProtectedRoute.tsx` listen for it -- and neither is mounted when the user lands on `/`. So the recovery event is missed entirely.

**Fix**: Add a global auth event listener at the `App.tsx` level that catches `PASSWORD_RECOVERY` on ANY page and redirects to `/reset-password`. This runs before any page-level logic can redirect to the dashboard.

### Issue 2: Google OAuth Shows "Page Not Found"
The Google sign-in library navigates the browser to `/~oauth/initiate?provider=google&...`. This path is meant to be handled by the Lovable infrastructure (server-side proxy). However, the React Router only has a route for `/~oauth` (exact match), not `/~oauth/initiate`. If the infrastructure proxy doesn't intercept, the React app catches the request and the `*` wildcard route shows the "Page Not Found" component.

**Fix**: Change the route from `/~oauth` to `/~oauth/*` so it catches ALL sub-paths under `/~oauth` (including `/~oauth/initiate`). This ensures a loading spinner is shown instead of "Not Found" while the infrastructure processes the OAuth flow.

## Changes

### File: `src/App.tsx`
1. Create a new `AuthEventHandler` component inside the file that:
   - Uses `useNavigate()` and `useLocation()` from react-router
   - Sets up `supabase.auth.onAuthStateChange` on mount
   - When `PASSWORD_RECOVERY` event fires, navigates to `/reset-password` (regardless of current page)
   - Only acts on recovery events, doesn't interfere with normal auth flow
2. Render `AuthEventHandler` inside the `BrowserRouter` (it needs router context for `useNavigate`)
3. Change route from `path="/~oauth"` to `path="/~oauth/*"` to catch sub-paths

### File: `src/pages/Index.tsx`
- Add a check in `checkAuth`: before redirecting to dashboard, check if the current URL hash contains `type=recovery`. If so, skip the dashboard redirect and let the global handler take over.

### No changes needed to:
- `src/components/ProtectedRoute.tsx` -- already handles `PASSWORD_RECOVERY` correctly
- `src/pages/Auth.tsx` -- already handles `PASSWORD_RECOVERY` correctly
- `src/components/OAuthCallback.tsx` -- just a loading spinner, works as-is
- `src/pages/ResetPassword.tsx` -- works fine once users actually reach it

## Technical Details

### AuthEventHandler Component (in App.tsx)
```typescript
const AuthEventHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null; // renders nothing, just listens
};
```

### Index.tsx Recovery Check
```typescript
// In checkAuth function, before redirecting:
const hash = window.location.hash;
if (hash && hash.includes("type=recovery")) {
  return; // Let the global AuthEventHandler handle it
}
```

### Route Change
```
- <Route path="/~oauth" element={<OAuthCallback />} />
+ <Route path="/~oauth/*" element={<OAuthCallback />} />
```

