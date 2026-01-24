import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save, RefreshCw } from "lucide-react";

interface Setting {
  key: string;
  value: string;
}

export const AppSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Default settings structure
  const defaultSettings = {
    default_daily_credits: "8",
    default_monthly_credits: "40",
    maintenance_mode: "false",
    feature_paraphraser_enabled: "true",
    feature_data_analysis_enabled: "true",
    feature_document_editor_enabled: "true",
    feature_chat_enabled: "true",
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");

      if (error) throw error;

      // Merge with defaults
      const loadedSettings: Record<string, string> = { ...defaultSettings };
      data?.forEach((s: Setting) => {
        loadedSettings[s.key] = s.value;
      });

      setSettings(loadedSettings);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const callAdminOperation = async (action: string, params: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await supabase.functions.invoke("admin-operations", {
      body: { action, ...params },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  const handleSaveSetting = async (key: string, value: string) => {
    setIsSaving(true);
    try {
      await callAdminOperation("updateAppSetting", {
        key,
        value,
        reason: "Updated via admin panel"
      });
      
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success("Setting saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (key: string) => {
    const newValue = settings[key] === "true" ? "false" : "true";
    await handleSaveSetting(key, newValue);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-10" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-10" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credit Settings */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Credit Configuration
          </CardTitle>
          <CardDescription>Default credit allocations for new users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Daily Credits</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={settings.default_daily_credits}
                  onChange={(e) => setSettings(prev => ({ ...prev, default_daily_credits: e.target.value }))}
                />
                <Button 
                  onClick={() => handleSaveSetting("default_daily_credits", settings.default_daily_credits)}
                  disabled={isSaving}
                  size="icon"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Credits given to users daily</p>
            </div>

            <div className="space-y-2">
              <Label>Default Monthly Credits</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={settings.default_monthly_credits}
                  onChange={(e) => setSettings(prev => ({ ...prev, default_monthly_credits: e.target.value }))}
                />
                <Button 
                  onClick={() => handleSaveSetting("default_monthly_credits", settings.default_monthly_credits)}
                  disabled={isSaving}
                  size="icon"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Monthly credit allocation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Global application configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">
                When enabled, shows a maintenance banner to users
              </p>
            </div>
            <Switch
              checked={settings.maintenance_mode === "true"}
              onCheckedChange={() => handleToggle("maintenance_mode")}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Enable or disable specific features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">AI Chat</p>
              <p className="text-sm text-muted-foreground">Enable the AI chat feature</p>
            </div>
            <Switch
              checked={settings.feature_chat_enabled === "true"}
              onCheckedChange={() => handleToggle("feature_chat_enabled")}
              disabled={isSaving}
            />
          </div>
          <Separator />
          
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Paraphraser</p>
              <p className="text-sm text-muted-foreground">Enable the text paraphrasing tool</p>
            </div>
            <Switch
              checked={settings.feature_paraphraser_enabled === "true"}
              onCheckedChange={() => handleToggle("feature_paraphraser_enabled")}
              disabled={isSaving}
            />
          </div>
          <Separator />
          
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Data Analysis</p>
              <p className="text-sm text-muted-foreground">Enable the statistical analysis tool</p>
            </div>
            <Switch
              checked={settings.feature_data_analysis_enabled === "true"}
              onCheckedChange={() => handleToggle("feature_data_analysis_enabled")}
              disabled={isSaving}
            />
          </div>
          <Separator />
          
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Document Editor</p>
              <p className="text-sm text-muted-foreground">Enable the document editor feature</p>
            </div>
            <Switch
              checked={settings.feature_document_editor_enabled === "true"}
              onCheckedChange={() => handleToggle("feature_document_editor_enabled")}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
