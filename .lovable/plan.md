

# Fix Google OAuth Infinite "Completing Sign In" Spinner

## Root Cause

The `OAuthCallback` component at `/~oauth/*` is purely a static loading spinner. After Google OAuth completes, the Lovable auth module processes the tokens and sets the Supabase session. However, the `OAuthCallback` component never listens for the session to be established and never navigates the user to the dashboard. Result: infinite spinner.

## Fix

### File: `src/components/OAuthCallback.tsx`
Update the component to:
1. Listen for `onAuthStateChange` events -- specifically `SIGNED_IN`
2. When a session is detected, navigate to `/dashboard`
3. Add a timeout fallback (e.g., 10 seconds) that redirects to `/auth` with an error message if no session is established
4. Add `console.log` statements at key points for debugging:
   - Component mount
   - Auth state change events received
   - Session detected / timeout triggered

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    console.log("[OAuthCallback] Component mounted, waiting for session...");
    console.log("[OAuthCallback] Current URL:", window.location.href);

    // Check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[OAuthCallback] Initial session check:", session ? "found" : "none");
      if (session && !hasRedirected) {
        setHasRedirected(true);
        console.log("[OAuthCallback] Redirecting to dashboard (existing session)");
        navigate("/dashboard", { replace: true });
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[OAuthCallback] Auth event:", event, "Session:", session ? "exists" : "none");
      if (event === "SIGNED_IN" && session && !hasRedirected) {
        setHasRedirected(true);
        console.log("[OAuthCallback] SIGNED_IN detected, redirecting to dashboard");
        navigate("/dashboard", { replace: true });
      }
    });

    // Timeout fallback - if no session after 15 seconds, redirect to auth
    const timeout = setTimeout(() => {
      if (!hasRedirected) {
        console.log("[OAuthCallback] Timeout reached, redirecting to /auth");
        toast.error("Sign in took too long. Please try again.");
        navigate("/auth", { replace: true });
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, hasRedirected]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
```

### Key behaviors:
- On mount, immediately checks if a session already exists (in case the token was already processed)
- Listens for `SIGNED_IN` events from the auth state change listener
- Has a 15-second safety timeout that redirects back to `/auth` with an error toast if something goes wrong
- Console logs at every step for easy debugging

### No other files need changes
- `src/App.tsx` already has the correct `/~oauth/*` route
- `src/integrations/lovable/index.ts` handles the token exchange automatically
- The `AuthEventHandler` in `App.tsx` handles `PASSWORD_RECOVERY` separately

