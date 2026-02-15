import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";

const PUBLIC_PATHS = ["/", "/auth", "/reset-password", "/pricing", "/~oauth"];
const ADMIN_PATH = "/admin";

export const SuspensionBanner = () => {
  const [isSuspended, setIsSuspended] = useState(false);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsSuspended(false);
          setChecked(true);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .single();

        setIsSuspended(profile?.status === "suspended");
      } catch {
        // Silently fail
      } finally {
        setChecked(true);
      }
    };

    check();
  }, [location.pathname]);

  if (!checked || !isSuspended) return null;

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  const isAdminPath = location.pathname.startsWith(ADMIN_PATH);

  if (isPublicPath || isAdminPath) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-md mx-4 text-center space-y-4">
        <Ban className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Account Suspended</h2>
        <p className="text-muted-foreground">
          Your account has been suspended by an administrator. If you believe this is an error, please contact support.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh to Check Status
        </Button>
      </div>
    </div>
  );
};
