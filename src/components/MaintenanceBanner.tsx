import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

const PUBLIC_PATHS = ["/", "/auth", "/reset-password", "/pricing", "/~oauth"];
const ADMIN_PATH = "/admin";

export const MaintenanceBanner = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      try {
        // Fetch maintenance_mode setting
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .maybeSingle();

        const maintenance = data?.value === "true";
        setIsMaintenanceMode(maintenance);

        if (maintenance) {
          // Check if current user is admin
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .in("role", ["admin", "super_admin"]);

            setIsAdmin((roleData && roleData.length > 0) || false);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setChecked(true);
      }
    };

    check();
  }, [location.pathname]);

  if (!checked || !isMaintenanceMode) return null;

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  const isAdminPath = location.pathname.startsWith(ADMIN_PATH);

  // Block non-admin users from feature pages during maintenance
  if (!isAdmin && !isPublicPath && !isAdminPath) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
          <h1 className="text-2xl font-bold">Under Maintenance</h1>
          <p className="text-muted-foreground">
            The app is currently undergoing maintenance. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // Show banner for admins
  if (isAdmin) {
    return (
      <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 text-center text-sm font-medium text-yellow-700 dark:text-yellow-300">
        <AlertTriangle className="h-4 w-4 inline mr-2" />
        Maintenance mode is ON. Non-admin users are blocked from accessing the app.
      </div>
    );
  }

  return null;
};
