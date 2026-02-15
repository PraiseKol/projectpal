import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, CreditCard, Calendar, GraduationCap, Receipt } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsSkeleton } from "@/components/skeletons/SettingsSkeleton";
import { EmailPreferences } from "@/components/Settings/EmailPreferences";
import { AmbassadorRequestCard } from "@/components/Settings/AmbassadorRequestCard";
import { ReferralCodeCard } from "@/components/Settings/ReferralCodeCard";
import { translateError, logError } from "@/utils/errorMessages";

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserEmail(user.email || "");
      setUserId(user.id);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);

      // Check ambassador role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "ambassador")
        .maybeSingle();
      setIsAmbassador(!!roleData);
    } catch (error) {
      logError("Settings:loadUserData", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Format expiry date
  const formatExpiryDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Check if user has active subscription
  const isActiveSubscriber = () => {
    if (profile?.plan_type === 'free') return false;
    if (!profile?.credits_expiry_date) return false;
    return new Date(profile.credits_expiry_date) > new Date();
  };

  // Check if subscription is expired
  const isSubscriptionExpired = () => {
    if (profile?.plan_type === 'free') return false;
    if (!profile?.credits_expiry_date) return true;
    return new Date(profile.credits_expiry_date) < new Date();
  };

  // Check if daily credits should show as full (new day)
  const getSmartDailyCredits = () => {
    if (!profile?.daily_reset_date) return profile?.daily_credits ?? 8;
    const today = new Date().toISOString().split('T')[0];
    const resetDate = new Date(profile.daily_reset_date).toISOString().split('T')[0];
    
    if (isActiveSubscriber()) {
      return resetDate !== today ? 8 : (profile?.daily_credits ?? 8);
    } else {
      if (resetDate !== today) {
        return Math.min(8, profile?.monthly_credits ?? 0);
      }
      return profile?.daily_credits ?? 0;
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm" className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-primary rounded-lg sm:rounded-xl">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <span className="text-lg sm:text-xl font-bold">Settings</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
        {/* Quick Links */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate("/transactions")} variant="outline" className="w-full justify-start rounded-xl">
              <CreditCard className="h-4 w-4 mr-2" />
              Transaction History
            </Button>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-accent rounded-xl shadow-sm">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Email Address</div>
                <div className="font-medium">{userEmail}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan & Credits */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Plan & Credits</CardTitle>
            <CardDescription>Your current subscription and credit balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-accent rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                  <div className="font-medium">
                    <Badge className="mt-1">{profile?.plan_type?.toUpperCase()}</Badge>
                  </div>
                </div>
              </div>
              <Button onClick={() => navigate("/pricing")} className="rounded-xl">
                {profile?.plan_type === 'free' ? 'Upgrade Plan' : 'Purchase Credits'}
              </Button>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2">
              <div className="p-4 bg-accent rounded-xl shadow-sm">
                <div className="text-sm text-muted-foreground">
                  Daily Credits {isActiveSubscriber() ? '(Unlimited)' : '(From Monthly Pool)'}
                </div>
                <div className="text-3xl font-bold">
                  <span>{getSmartDailyCredits()}</span>
                  <span className="text-lg text-muted-foreground font-normal">/8</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isActiveSubscriber() 
                    ? 'Resets daily (no monthly cap)' 
                    : 'Counts towards 40/month limit'}
                </div>
              </div>
              
              {/* Show monthly credits for free users OR expired subscribers */}
              {(profile?.plan_type === 'free' || isSubscriptionExpired()) ? (
                <div className="p-4 bg-accent rounded-xl shadow-sm">
                  <div className="text-sm text-muted-foreground">Monthly Credits</div>
                  <div className="text-3xl font-bold">
                    <span>{profile?.monthly_credits}</span>
                    <span className="text-lg text-muted-foreground font-normal">/40</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Resets monthly</div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl shadow-sm border border-primary/20">
                  <div className="text-sm text-muted-foreground">Paid Credits</div>
                  <div className="text-3xl font-bold">
                    <span>{profile?.paid_credits || 0}</span>
                    <span className="text-lg text-muted-foreground font-normal"> remaining</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {profile?.credits_expiry_date 
                      ? `Expires: ${formatExpiryDate(profile.credits_expiry_date)}`
                      : 'No expiry set'}
                  </div>
                </div>
              )}
            </div>
            {profile?.plan_type !== 'free' && (
              <p className="text-xs text-muted-foreground mt-2">Daily credits are consumed first, then paid credits</p>
            )}

            {/* Credits Expiry Info for Pro/Scholar */}
            {profile?.plan_type !== 'free' && profile?.credits_expiry_date && (
              <div className="p-4 bg-accent rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Credits Expiry Date</div>
                    <div className="font-medium">{formatExpiryDate(profile.credits_expiry_date)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(profile.credits_expiry_date) > new Date()
                        ? 'Paid credits are active and will carry over on renewal'
                        : 'Paid credits have expired - purchase more to continue'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profile?.daily_reset_date && (
              <div className="flex items-center gap-3 p-4 bg-accent rounded-xl shadow-sm">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Last Daily Reset</div>
                  <div className="font-medium">
                    {new Date(profile.daily_reset_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ambassador Request */}
        <AmbassadorRequestCard userId={userId} isAmbassador={isAmbassador} planType={profile?.plan_type || 'free'} creditsExpiry={profile?.credits_expiry_date || null} />

        {/* Referral Code */}
        <ReferralCodeCard referredBy={profile?.referred_by} onUpdate={loadUserData} />

        {/* Email Preferences */}
        <EmailPreferences />
      </main>
    </div>
  );
};

export default Settings;
