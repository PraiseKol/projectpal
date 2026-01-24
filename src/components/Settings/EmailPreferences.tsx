import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Megaphone, Bell, BarChart3, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailPreferencesState {
  marketing_emails: boolean;
  activity_reminders: boolean;
  usage_reports: boolean;
  reengagement_emails: boolean;
  unsubscribed_all: boolean;
}

export const EmailPreferences = () => {
  const [preferences, setPreferences] = useState<EmailPreferencesState>({
    marketing_emails: true,
    activity_reminders: true,
    usage_reports: true,
    reengagement_emails: true,
    unsubscribed_all: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<EmailPreferencesState | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (originalPreferences) {
      const changed = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
      setHasChanges(changed);
    }
  }, [preferences, originalPreferences]);

  const loadPreferences = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("manage-email-preferences", {
        body: { action: "get" },
      });

      if (error) throw error;

      const prefs = {
        marketing_emails: data.marketing_emails ?? true,
        activity_reminders: data.activity_reminders ?? true,
        usage_reports: data.usage_reports ?? true,
        reengagement_emails: data.reengagement_emails ?? true,
        unsubscribed_all: data.unsubscribed_all ?? false,
      };

      setPreferences(prefs);
      setOriginalPreferences(prefs);
    } catch (error) {
      console.error("Error loading email preferences:", error);
      toast.error("Failed to load email preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-email-preferences", {
        body: {
          action: "update",
          ...preferences,
        },
      });

      if (error) throw error;

      setOriginalPreferences(preferences);
      toast.success("Email preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferencesState) => {
    if (key === "unsubscribed_all") {
      setPreferences(prev => ({
        ...prev,
        unsubscribed_all: !prev.unsubscribed_all,
      }));
    } else {
      setPreferences(prev => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which emails you'd like to receive from ProjectPal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {preferences.unsubscribed_all && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-xl">
            <p className="text-sm font-medium">You are unsubscribed from all emails</p>
            <p className="text-xs mt-1">Toggle off "Unsubscribe from all" below to receive emails again</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="marketing" className="font-medium">Marketing & Promotional</Label>
                <p className="text-sm text-muted-foreground">New features, tips, and special offers</p>
              </div>
            </div>
            <Switch
              id="marketing"
              checked={preferences.marketing_emails && !preferences.unsubscribed_all}
              onCheckedChange={() => handleToggle("marketing_emails")}
              disabled={preferences.unsubscribed_all}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="activity" className="font-medium">Activity Reminders</Label>
                <p className="text-sm text-muted-foreground">Notifications about pending documents and analyses</p>
              </div>
            </div>
            <Switch
              id="activity"
              checked={preferences.activity_reminders && !preferences.unsubscribed_all}
              onCheckedChange={() => handleToggle("activity_reminders")}
              disabled={preferences.unsubscribed_all}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="usage" className="font-medium">Weekly Usage Reports</Label>
                <p className="text-sm text-muted-foreground">Summary of your credits and activity each week</p>
              </div>
            </div>
            <Switch
              id="usage"
              checked={preferences.usage_reports && !preferences.unsubscribed_all}
              onCheckedChange={() => handleToggle("usage_reports")}
              disabled={preferences.unsubscribed_all}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="reengagement" className="font-medium">Re-engagement</Label>
                <p className="text-sm text-muted-foreground">We'll reach out if you haven't logged in for a while</p>
              </div>
            </div>
            <Switch
              id="reengagement"
              checked={preferences.reengagement_emails && !preferences.unsubscribed_all}
              onCheckedChange={() => handleToggle("reengagement_emails")}
              disabled={preferences.unsubscribed_all}
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-xl border border-destructive/20">
          <div>
            <Label htmlFor="unsubscribe" className="font-medium text-destructive">Unsubscribe from all emails</Label>
            <p className="text-sm text-muted-foreground">You won't receive any emails from ProjectPal</p>
          </div>
          <Switch
            id="unsubscribe"
            checked={preferences.unsubscribed_all}
            onCheckedChange={() => handleToggle("unsubscribed_all")}
          />
        </div>

        {hasChanges && (
          <Button 
            onClick={savePreferences} 
            disabled={isSaving}
            className="w-full rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
