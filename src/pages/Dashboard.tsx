import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Sparkles, LogOut, CreditCard, GraduationCap, Settings as SettingsIcon, Receipt, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { SEO } from "@/components/SEO";

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [recentParaphrases, setRecentParaphrases] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);

      // Check if user is admin
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!rolesData);

      // Fetch recent chat sessions
      const { data: chatsData } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      setRecentChats(chatsData || []);

      // Fetch recent paraphrase logs if Scholar user
      if (profileData?.plan_type === "scholar") {
        const { data: paraphrasesData } = await supabase
          .from("paraphrase_logs")
          .select("id, input_text, output_text, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentParaphrases(paraphrasesData || []);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Signed out successfully");
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

  // Check if daily credits should show as full (new day)
  // Only active subscribers get unlimited daily credits
  const getSmartDailyCredits = () => {
    if (!profile?.daily_reset_date) return profile?.daily_credits ?? 8;
    const today = new Date().toISOString().split('T')[0];
    const resetDate = new Date(profile.daily_reset_date).toISOString().split('T')[0];
    
    if (isActiveSubscriber()) {
      // Active subscribers get fresh 8 daily credits every day
      return resetDate !== today ? 8 : (profile?.daily_credits ?? 8);
    } else {
      // Free/expired users: daily credits limited by monthly pool
      if (resetDate !== today) {
        // New day - show min(8, monthly remaining)
        return Math.min(8, profile?.monthly_credits ?? 0);
      }
      return profile?.daily_credits ?? 0;
    }
  };

  // Calculate remaining days until credits expire
  const getCreditsExpiryInfo = () => {
    if (!profile?.credits_expiry_date) return null;
    const expiry = new Date(profile.credits_expiry_date);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Estimate total days based on common billing periods
    const totalDays = diffDays > 200 ? 365 : diffDays > 60 ? 90 : 30;
    const percentage = Math.max(0, Math.min(100, (diffDays / totalDays) * 100));
    
    return {
      daysRemaining: diffDays > 0 ? diffDays : 0,
      percentage,
      isExpired: diffDays <= 0,
      isExpiringSoon: diffDays > 0 && diffDays <= 7,
      isWarning: diffDays > 7 && diffDays <= 30,
    };
  };

  const expiryInfo = getCreditsExpiryInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Dashboard | ScholarAI Hub"
        description="Manage your academic projects, track credits, and access AI-powered writing tools."
        keywords="academic writing, AI assistant, research projects, thesis writing"
      />
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold">ScholarAI Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-2">
              {isAdmin && (
                <Button onClick={() => navigate("/admin")} variant="outline" size="sm">
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button onClick={() => navigate("/transactions")} variant="outline" size="sm">
                <Receipt className="h-4 w-4 mr-2" />
                Transactions
              </Button>
              <Button onClick={() => navigate("/settings")} variant="outline" size="sm">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button onClick={handleSignOut} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
            {/* Mobile navigation */}
            <MobileNav isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Credit Info Card */}
        <Card className="mb-8 animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  Welcome Back{profile?.first_name ? `, ${profile.first_name}` : ''}!
                </CardTitle>
                <CardDescription className="mt-1">
                  Plan: <Badge className="ml-2 rounded-full">
                    {profile?.plan_type !== 'free' && expiryInfo?.isExpired 
                      ? 'FREE (Subscription Expired)' 
                      : profile?.plan_type?.toUpperCase()}
                  </Badge>
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/pricing")} variant="gradient" className="gap-2">
                <CreditCard className="h-4 w-4" />
                {expiryInfo?.isExpired ? 'Renew Plan' : 'Upgrade Plan'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2">
              <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                <div className="text-sm text-muted-foreground">
                  Daily Credits {isActiveSubscriber() ? '(Unlimited)' : '(From Monthly Pool)'}
                </div>
                <div className="text-3xl font-bold mt-1">
                  <span>{getSmartDailyCredits()}</span>
                  <span className="text-lg text-muted-foreground font-normal">/8</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isActiveSubscriber() 
                    ? 'Resets daily at midnight (no monthly cap)' 
                    : 'Counts towards 40/month limit'}
                </div>
              </div>
              
              {/* Show monthly credits for free users OR expired subscribers */}
              {(profile?.plan_type === 'free' || (profile?.plan_type !== 'free' && expiryInfo?.isExpired)) ? (
                <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                  <div className="text-sm text-muted-foreground">Monthly Credits</div>
                  <div className="text-3xl font-bold mt-1">
                    <span>{profile?.monthly_credits}</span>
                    <span className="text-lg text-muted-foreground font-normal">/40</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Resets monthly</div>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border ${
                  expiryInfo?.isExpiringSoon 
                    ? 'bg-destructive/10 border-destructive/30' 
                    : expiryInfo?.isWarning 
                      ? 'bg-yellow-500/10 border-yellow-500/30' 
                      : 'bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Paid Credits</div>
                    {expiryInfo?.isExpiringSoon && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expiring Soon!
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold mt-1">
                    <span>{profile?.paid_credits || 0}</span>
                    <span className="text-lg text-muted-foreground font-normal"> remaining</span>
                  </div>
                  
                  {expiryInfo && !expiryInfo.isExpired && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className={`h-4 w-4 ${
                          expiryInfo.isExpiringSoon 
                            ? 'text-destructive' 
                            : expiryInfo.isWarning 
                              ? 'text-yellow-500' 
                              : 'text-primary'
                        }`} />
                        <span className={`font-medium ${
                          expiryInfo.isExpiringSoon 
                            ? 'text-destructive' 
                            : expiryInfo.isWarning 
                              ? 'text-yellow-600 dark:text-yellow-400' 
                              : ''
                        }`}>
                          {expiryInfo.daysRemaining} days left
                        </span>
                      </div>
                      <Progress 
                        value={expiryInfo.percentage} 
                        className={`h-2 ${
                          expiryInfo.isExpiringSoon 
                            ? '[&>div]:bg-destructive' 
                            : expiryInfo.isWarning 
                              ? '[&>div]:bg-yellow-500' 
                              : '[&>div]:bg-primary'
                        }`}
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Expires: {formatExpiryDate(profile.credits_expiry_date)}
                        </div>
                        {(expiryInfo.isExpiringSoon || expiryInfo.isWarning) && (
                          <Button 
                            size="sm" 
                            variant={expiryInfo.isExpiringSoon ? "destructive" : "outline"}
                            className="h-7 text-xs gap-1"
                            onClick={() => navigate(`/pricing?plan=${profile.plan_type}&billing=monthly`)}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Renew
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {expiryInfo?.isExpired && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm text-destructive font-medium">
                        Credits have expired
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="w-full gap-1"
                        onClick={() => navigate(`/pricing?plan=${profile.plan_type}&billing=monthly`)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Renew Plan Now
                      </Button>
                    </div>
                  )}
                  
                  {!expiryInfo && (
                    <div className="text-xs text-muted-foreground mt-1">No expiry set</div>
                  )}
                </div>
              )}
            </div>
            {profile?.plan_type !== 'free' && (
              <p className="text-xs text-muted-foreground mt-2">Daily credits are consumed first, then paid credits</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {(recentChats.length > 0 || recentParaphrases.length > 0) && (
          <div className="mb-8 space-y-4">
            <h2 className="text-2xl font-bold">Recent Activity</h2>
            
            {recentChats.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Recent Chats</h3>
                  <Button onClick={() => navigate("/chat")} variant="ghost" size="sm">
                    View All
                  </Button>
                </div>
                <div className="grid gap-3">
                  {recentChats.map((chat) => (
                    <Card key={chat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/chat?session_id=${chat.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold truncate">{chat.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(chat.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" className="rounded-full">
                            Resume
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {profile?.plan_type === "scholar" && recentParaphrases.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Recent Paraphrases</h3>
                  <Button onClick={() => navigate("/paraphraser")} variant="ghost" size="sm">
                    View All
                  </Button>
                </div>
                <div className="grid gap-3">
                  {recentParaphrases.map((para) => (
                    <Card key={para.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/paraphraser")}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm line-clamp-2">{para.input_text}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(para.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-full">
                            View
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer animate-scale-in" onClick={() => navigate("/chat")}>
            <CardHeader>
              <MessageSquare className="h-12 w-12 mb-4 text-primary" />
              <CardTitle>Start Chat</CardTitle>
              <CardDescription>
                Chat with ScholarAI to generate topics, proposals, and chapters
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer animate-scale-in" onClick={() => navigate("/chat")}>
            <CardHeader>
              <FileText className="h-12 w-12 mb-4 text-primary" />
              <CardTitle>Generate Project</CardTitle>
              <CardDescription>
                Quick access to project topic generation and proposal writing
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer animate-scale-in" onClick={() => navigate("/chat")}>
            <CardHeader>
              <Sparkles className="h-12 w-12 mb-4 text-primary" />
              <CardTitle>Academic Writing</CardTitle>
              <CardDescription>
                Generate chapters, references, and edit your content
              </CardDescription>
            </CardHeader>
          </Card>

          {profile?.plan_type === "scholar" && (
            <>
              <Card variant="glass" className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in" onClick={() => navigate("/paraphraser")}>
                <CardHeader>
                  <FileText className="h-12 w-12 mb-4 text-secondary" />
                  <CardTitle>Paraphraser</CardTitle>
                  <CardDescription>
                    Rephrase and improve your academic text
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card variant="glass" className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in" onClick={() => navigate("/documents")}>
                <CardHeader>
                  <Sparkles className="h-12 w-12 mb-4 text-secondary" />
                  <CardTitle>PPT Generator</CardTitle>
                  <CardDescription>
                    Upload documents and generate PowerPoint presentations
                  </CardDescription>
                </CardHeader>
              </Card>
            </>
          )}
        </div>

        {/* Feature Notice */}
        {profile?.plan_type === "free" && (
          <Card className="mt-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Sparkles className="h-6 w-6 mt-1 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Unlock Premium Features</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upgrade to Pro or Scholar plan to get more credits and access features like document upload, PPT generation, and paraphraser tool.
                  </p>
                  <Button onClick={() => navigate("/pricing")} size="sm" variant="gradient">
                    View Plans
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
