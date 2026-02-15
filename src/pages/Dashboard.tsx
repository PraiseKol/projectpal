import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  FileText,
  Sparkles,
  LogOut,
  CreditCard,
  Settings as SettingsIcon,
  Receipt,
  AlertTriangle,
  Clock,
  RefreshCw,
  Lock,
  BarChart3,
  Users,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { SEO } from "@/components/SEO";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { translateError, logError } from "@/utils/errorMessages";

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [recentParaphrases, setRecentParaphrases] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [defaultDailyCredits, setDefaultDailyCredits] = useState(8);
  const [defaultMonthlyCredits, setDefaultMonthlyCredits] = useState(40);
  const [upgradeDialog, setUpgradeDialog] = useState<{
    open: boolean;
    feature: string;
    description: string;
    requiredPlan: "pro" | "scholar";
  } | null>(null);

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

      // Check user roles (admin, super_admin, ambassador)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const roles = rolesData?.map(r => r.role) || [];
      setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
      setIsAmbassador(roles.includes("ambassador"));

      // Fetch recent chat sessions
      const { data: chatsData } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

      setRecentChats(chatsData || []);

      // Fetch recent paraphrase logs for all users
      const { data: paraphrasesData } = await supabase
        .from("paraphrase_logs")
        .select("id, input_text, output_text, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentParaphrases(paraphrasesData || []);

      // Fetch admin-configured credit defaults
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["default_daily_credits", "default_monthly_credits"]);

      settingsData?.forEach((s: { key: string; value: string }) => {
        if (s.key === "default_daily_credits") setDefaultDailyCredits(parseInt(s.value) || 8);
        if (s.key === "default_monthly_credits") setDefaultMonthlyCredits(parseInt(s.value) || 40);
      });
    } catch (error) {
      logError("Dashboard:checkAuth", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Signed out successfully");
  };

  const handleDeleteChat = async () => {
    const chatId = deleteChatId;
    if (!chatId) return;

    setIsDeletingChat(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Delete messages first (FK)
      await supabase.from("messages").delete().eq("session_id", chatId);

      const { error } = await supabase.from("chat_sessions").delete().eq("id", chatId);
      if (error) throw error;

      setRecentChats((prev) => prev.filter((c) => c.id !== chatId));
      toast.success("Chat deleted");
    } catch (error) {
      logError("Dashboard:deleteChat", error);
      toast.error(translateError(error));
    } finally {
      setIsDeletingChat(false);
      setDeleteChatId(null);
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

  // Check if daily credits should show as full (new day)
  // Only active subscribers get unlimited daily credits
  const getSmartDailyCredits = () => {
    if (!profile?.daily_reset_date) return profile?.daily_credits ?? defaultDailyCredits;
    const today = new Date().toISOString().split('T')[0];
    const resetDate = new Date(profile.daily_reset_date).toISOString().split('T')[0];
    
    if (isActiveSubscriber()) {
      return resetDate !== today ? defaultDailyCredits : (profile?.daily_credits ?? defaultDailyCredits);
    } else {
      if (resetDate !== today) {
        return Math.min(defaultDailyCredits, profile?.monthly_credits ?? 0);
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

  // Access control helpers
  const planHierarchy: Record<string, number> = { free: 0, pro: 1, scholar: 2 };
  
  const canAccessFeature = (requiredPlan: 'pro' | 'scholar') => {
    const userPlanLevel = planHierarchy[profile?.plan_type || 'free'];
    const requiredLevel = planHierarchy[requiredPlan];
    // Also check if subscription is expired
    if (profile?.plan_type !== 'free' && expiryInfo?.isExpired) {
      return false;
    }
    return userPlanLevel >= requiredLevel;
  };

  const handleFeatureClick = (
    feature: string,
    route: string,
    requiredPlan?: 'pro' | 'scholar',
    description?: string
  ) => {
    if (!requiredPlan || canAccessFeature(requiredPlan)) {
      navigate(route);
    } else {
      setUpgradeDialog({
        open: true,
        feature,
        description: description || `This feature requires a ${requiredPlan} plan.`,
        requiredPlan,
      });
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Dashboard | ProjectPal"
        description="Manage your academic projects, track credits, and access AI-powered writing tools."
        keywords="academic writing, AI assistant, research projects, thesis writing"
      />

      <AlertDialog open={!!deleteChatId} onOpenChange={(open) => !open && setDeleteChatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingChat}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              disabled={isDeletingChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingChat ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <ProjectPalLogo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-2">
              {isAmbassador && (
                <Button onClick={() => navigate("/ambassador")} variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Ambassador
                </Button>
              )}
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
            <MobileNav isAdmin={isAdmin} isAmbassador={isAmbassador} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Credit Info Card */}
        <Card className="mb-8 animate-fade-in">
          <CardHeader>
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl">
                  Welcome Back{profile?.first_name ? `, ${profile.first_name}` : ''}!
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-1 flex items-center">
                  Plan: <Badge className="ml-2 rounded-full">
                    {profile?.plan_type !== 'free' && expiryInfo?.isExpired 
                      ? 'FREE (Subscription Expired)' 
                      : profile?.plan_type?.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <Button onClick={() => navigate("/pricing")} variant="gradient" className="gap-2 w-full xs:w-auto">
                <CreditCard className="h-4 w-4" />
                {expiryInfo?.isExpired ? 'Renew Plan' : 'Upgrade Plan'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2">
              <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                <div className="text-sm text-muted-foreground">
                  Daily Credits {isActiveSubscriber() ? '(Unlimited)' : '(From Monthly Pool)'}
                </div>
                <div className="text-3xl font-bold mt-1">
                  <span>{getSmartDailyCredits()}</span>
                  <span className="text-lg text-muted-foreground font-normal">/{defaultDailyCredits}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isActiveSubscriber() 
                    ? 'Resets daily at midnight (no monthly cap)' 
                    : `Counts towards ${defaultMonthlyCredits}/month limit`}
                </div>
              </div>
              
              {/* Show monthly credits for free users OR expired subscribers */}
              {(profile?.plan_type === 'free' || (profile?.plan_type !== 'free' && expiryInfo?.isExpired)) ? (
                <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                  <div className="text-sm text-muted-foreground">Monthly Credits</div>
                  <div className="text-3xl font-bold mt-1">
                    <span>{profile?.monthly_credits}</span>
                    <span className="text-lg text-muted-foreground font-normal">/{defaultMonthlyCredits}</span>
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-3 space-y-2 cursor-help">
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
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs p-3">
                          <div className="space-y-1.5">
                            <p className="font-medium text-sm">Subscription Status</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              You have <span className="font-medium text-foreground">{profile?.paid_credits || 0} credits</span> remaining. 
                              Your subscription expires on <span className="font-medium text-foreground">{formatExpiryDate(profile.credits_expiry_date)}</span>.
                              Daily credits ({defaultDailyCredits}/day) are used first, then paid credits.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
          <div className="mb-8 space-y-4 overflow-hidden">
            <h2 className="text-2xl font-bold">Recent Activity</h2>
            
            {recentChats.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Recent Chats</h3>
                </div>
                <div className="grid gap-3">
                  {(showAllChats ? recentChats : recentChats.slice(0, 3)).map((chat) => (
                    <Card
                      key={chat.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/chat?session_id=${chat.id}`)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate text-sm sm:text-base">{chat.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {new Date(chat.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteChatId(chat.id);
                              }}
                              aria-label={`Delete chat: ${chat.title}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button size="sm" className="rounded-full text-xs sm:text-sm px-2 sm:px-3">
                              Resume
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {recentChats.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground text-xs mt-2"
                    onClick={() => setShowAllChats(!showAllChats)}
                  >
                    {showAllChats ? "Show Less" : `View All (${recentChats.length})`}
                  </Button>
                )}
              </div>
            )}

            {recentParaphrases.length > 0 && (
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
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

          {/* Paraphraser - Available to all users with different limits */}
          <Card 
            variant={profile?.plan_type === "scholar" || profile?.plan_type === "pro" ? "glass" : "default"} 
            className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in relative" 
            onClick={() => navigate("/paraphraser")}
          >
            <CardHeader>
              <FileText className="h-12 w-12 mb-4 text-secondary" />
              <div className="flex items-center gap-2">
                <CardTitle>Paraphraser</CardTitle>
                {profile?.plan_type === "free" && (
                  <Badge variant="secondary" className="text-xs">3 Free/Day</Badge>
                )}
              </div>
              <CardDescription>
                {profile?.plan_type === "free" 
                  ? "Try it free! 3 paraphrases per day (120 words max)"
                  : "Rephrase and improve your academic text"
                }
              </CardDescription>
            </CardHeader>
          </Card>

          {/* PPT Generator - Visible to all, Scholar Only access */}
          <Card 
            variant={canAccessFeature('scholar') ? "glass" : "default"} 
            className={`hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in ${
              !canAccessFeature('scholar') ? 'opacity-80' : ''
            }`}
            onClick={() => handleFeatureClick(
              'PPT Generator',
              '/documents',
              'scholar',
              'Create professional PowerPoint presentations from your documents with AI. This premium feature is exclusively available for Scholar plan users.'
            )}
          >
            <CardHeader>
              <Sparkles className="h-12 w-12 mb-4 text-secondary" />
              <div className="flex items-center gap-2">
                <CardTitle>PPT Generator</CardTitle>
                {canAccessFeature('scholar') ? (
                  <Badge variant="secondary" className="text-xs">6 Credits</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    Scholar Only
                  </Badge>
                )}
              </div>
              <CardDescription>
                Upload documents and generate PowerPoint presentations
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Document Editor - Visible to all, Pro & Scholar access */}
          <Card 
            variant={canAccessFeature('pro') ? "glass" : "default"} 
            className={`hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in ${
              !canAccessFeature('pro') ? 'opacity-80' : ''
            }`}
            onClick={() => handleFeatureClick(
              'Document Editor',
              '/document-editor',
              'pro',
              'Upload documents to edit, generate or analyze. Available for Pro and Scholar plan users.'
            )}
          >
            <CardHeader>
              <FileText className="h-12 w-12 mb-4 text-secondary" />
              <div className="flex items-center gap-2">
                <CardTitle>Document Editor</CardTitle>
                {!canAccessFeature('pro') && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    Pro & Scholar
                  </Badge>
                )}
              </div>
              <CardDescription>
                Upload documents to edit, generate or analyze
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Questionnaire Builder - Pro & Scholar access */}
          <Card 
            variant={canAccessFeature('pro') ? "glass" : "default"} 
            className={`hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in ${
              !canAccessFeature('pro') ? 'opacity-80' : ''
            }`}
            onClick={() => handleFeatureClick(
              'Questionnaire Builder',
              '/questionnaire-builder',
              'pro',
              'Design and export professional questionnaires with multiple question types. Available for Pro and Scholar plan users.'
            )}
          >
            <CardHeader>
              <ClipboardList className="h-12 w-12 mb-4 text-primary" />
              <div className="flex items-center gap-2">
                <CardTitle>Questionnaire Builder</CardTitle>
                {!canAccessFeature('pro') && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    Pro & Scholar
                  </Badge>
                )}
              </div>
              <CardDescription>
                Design questionnaires with sections, rating scales, and export to PDF/DOCX
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Data Analysis - Scholar Only */}
          <Card 
            variant={canAccessFeature('scholar') ? "glass" : "default"} 
            className={`hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer animate-scale-in ${
              !canAccessFeature('scholar') ? 'opacity-80' : ''
            }`}
            onClick={() => handleFeatureClick(
              'Data Analysis',
              '/data-analysis',
              'scholar',
              'Analyze survey data with statistical methods for Chapter 4. This premium feature is exclusively available for Scholar plan users.'
            )}
          >
            <CardHeader>
              <BarChart3 className="h-12 w-12 mb-4 text-primary" />
              <div className="flex items-center gap-2">
                <CardTitle>Data Analysis</CardTitle>
                {!canAccessFeature('scholar') ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    Scholar Only
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Scholar</Badge>
                )}
              </div>
              <CardDescription>
                Analyze survey data with statistical methods for Chapter 4
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Upgrade Dialog */}
        {upgradeDialog && (
          <UpgradeDialog
            open={upgradeDialog.open}
            onOpenChange={(open) => setUpgradeDialog(open ? upgradeDialog : null)}
            featureName={upgradeDialog.feature}
            featureDescription={upgradeDialog.description}
            requiredPlan={upgradeDialog.requiredPlan}
            currentPlan={profile?.plan_type || 'free'}
          />
        )}

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
