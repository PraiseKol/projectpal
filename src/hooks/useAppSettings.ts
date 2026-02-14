import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  [key: string]: string;
}

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key, value");

        if (error) throw error;

        const map: AppSettings = {};
        data?.forEach((s) => {
          map[s.key] = s.value;
        });
        setSettings(map);
      } catch (error) {
        console.error("Failed to load app settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const getSetting = (key: string, defaultValue = "") =>
    settings[key] ?? defaultValue;

  const isMaintenanceMode = settings.maintenance_mode === "true";

  const isFeatureEnabled = (feature: string) =>
    settings[`feature_${feature}_enabled`] !== "false";

  return { settings, isLoading, getSetting, isMaintenanceMode, isFeatureEnabled };
};
