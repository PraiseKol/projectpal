import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    console.log("[OAuthCallback] Component mounted");
    console.log("[OAuthCallback] URL:", window.location.href);
    console.log("[OAuthCallback] Hash:", window.location.hash);
    console.log("[OAuthCallback] Search:", window.location.search);

    // Extract tokens from URL hash or query params (standalone redirect flow)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const access_token = hashParams.get("access_token") || queryParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token") || queryParams.get("refresh_token");

    console.log("[OAuthCallback] access_token found:", !!access_token);
    console.log("[OAuthCallback] refresh_token found:", !!refresh_token);

    if (access_token && refresh_token) {
      console.log("[OAuthCallback] Setting session from URL tokens...");
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          console.error("[OAuthCallback] setSession error:", error.message);
          toast.error("Sign in failed. Please try again.");
          navigate("/auth", { replace: true });
        } else {
          console.log("[OAuthCallback] Session set successfully from URL tokens");
        }
      });
    }

    // Check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[OAuthCallback] Initial session check:", session ? "found" : "none");
      if (session && !hasRedirected) {
        setHasRedirected(true);
        navigate("/dashboard", { replace: true });
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[OAuthCallback] Auth event:", event, "Session:", session ? "exists" : "none");
      if (event === "SIGNED_IN" && session && !hasRedirected) {
        setHasRedirected(true);
        navigate("/dashboard", { replace: true });
      }
    });

    // Timeout fallback
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
