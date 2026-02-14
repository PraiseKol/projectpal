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
