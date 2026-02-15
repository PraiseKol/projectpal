import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParaphraserSkeleton } from "@/components/skeletons/ParaphraserSkeleton";
import { translateError, logError } from "@/utils/errorMessages";

const FREE_WORD_LIMIT = 120;
const FREE_DAILY_LIMIT = 3;

const Paraphraser = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [canExport, setCanExport] = useState(true);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [dailyParaphraseCount, setDailyParaphraseCount] = useState(0);
  const [isActiveSubscriber, setIsActiveSubscriber] = useState(false);

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const isFreeUser = !isActiveSubscriber;
  const isOverWordLimit = isFreeUser && wordCount > FREE_WORD_LIMIT;
  const hasUsedDailyLimit = isFreeUser && dailyParaphraseCount >= FREE_DAILY_LIMIT;

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

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan_type, credits_expiry_date, daily_paraphrase_count, daily_reset_date")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setUserPlan(profile.plan_type);

      // Check if subscription is active
      const paidCreditsExpired = profile.credits_expiry_date 
        ? new Date(profile.credits_expiry_date) < new Date() 
        : true;
      const activeSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;
      setIsActiveSubscriber(activeSubscriber);
      setCanExport(activeSubscriber);

      // Check daily paraphrase count for free users
      const today = new Date().toISOString().split('T')[0];
      const resetDate = profile.daily_reset_date 
        ? new Date(profile.daily_reset_date).toISOString().split('T')[0] 
        : null;
      
      if (resetDate !== today) {
        setDailyParaphraseCount(0);
      } else {
        setDailyParaphraseCount(profile.daily_paraphrase_count || 0);
      }

      setIsCheckingAuth(false);
    } catch (error) {
      logError("Paraphraser:checkAuth", error);
      navigate("/dashboard");
    }
  };

  const handleParaphrase = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter text to paraphrase.",
        variant: "destructive",
      });
      return;
    }

    if (isOverWordLimit) {
      toast({
        title: "Word Limit Exceeded",
        description: `Free users are limited to ${FREE_WORD_LIMIT} words. Upgrade for unlimited paraphrasing.`,
        variant: "destructive",
      });
      return;
    }

    if (hasUsedDailyLimit) {
      toast({
        title: "Daily Limit Reached",
        description: "Free users can paraphrase 3 times per day. Upgrade for unlimited access!",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setOutputText("");

    try {
      const { data, error } = await supabase.functions.invoke("paraphrase-ai", {
        body: { text: inputText },
      });

      if (error) throw error;

      if (data.error) {
        if (data.word_limit_exceeded) {
          toast({
            title: "Word Limit Exceeded",
            description: data.error,
            variant: "destructive",
          });
        } else if (data.daily_limit_reached) {
          toast({
            title: "Daily Limit Reached",
            description: data.error,
            variant: "destructive",
          });
          setDailyParaphraseCount(prev => prev + 1);
        } else {
          toast({
            title: "Error",
            description: data.error,
            variant: "destructive",
          });
        }
        return;
      }

      setOutputText(data.paraphrased_text);
      setCanExport(data.can_export);
      
      if (data.profile?.daily_paraphrase_count !== undefined) {
        setDailyParaphraseCount(data.profile.daily_paraphrase_count);
      }
    } catch (error: any) {
      logError("Paraphraser:paraphrase", error);
      toast({
        title: "Paraphrase Error",
        description: translateError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!canExport) {
      toast({
        title: "Upgrade Required",
        description: "Upgrade to Pro or Scholar to copy and download paraphrased text.",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard.writeText(outputText);
    toast({
      title: "Copied!",
      description: "Paraphrased text copied to clipboard.",
    });
  };

  const handleDownload = () => {
    if (!canExport) {
      toast({
        title: "Upgrade Required",
        description: "Upgrade to Pro or Scholar to download paraphrased text.",
        variant: "destructive",
      });
      return;
    }
    const blob = new Blob([outputText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paraphrased-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Paraphrased text saved as TXT file.",
    });
  };

  if (isCheckingAuth) {
    return <ParaphraserSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="self-start">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">Back to Dashboard</span>
            <span className="xs:hidden">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <h1 className="text-xl sm:text-2xl font-bold">AI Paraphraser</h1>
            <Badge variant={isActiveSubscriber ? "default" : "secondary"}>
              {isActiveSubscriber ? userPlan.toUpperCase() : "FREE"}
            </Badge>
          </div>
        </div>

        {/* Free User Notice */}
        {isFreeUser && (
          <Card className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Free Plan Limits</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasUsedDailyLimit 
                    ? "You've used your daily paraphrases. Come back tomorrow or upgrade for unlimited access!"
                    : `${FREE_DAILY_LIMIT - dailyParaphraseCount}/${FREE_DAILY_LIMIT} paraphrases remaining today • Max ${FREE_WORD_LIMIT} words • No export`
                  }
                </p>
                <Button 
                  size="sm" 
                  variant="gradient" 
                  className="mt-2"
                  onClick={() => navigate("/pricing")}
                >
                  Upgrade for Unlimited
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold">Input Text</h2>
              {isFreeUser && (
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isOverWordLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {wordCount}/{FREE_WORD_LIMIT} words
                  </span>
                  {isOverWordLimit && <AlertTriangle className="h-4 w-4 text-destructive" />}
                </div>
              )}
            </div>
            
            {isFreeUser && (
              <Progress 
                value={(wordCount / FREE_WORD_LIMIT) * 100} 
                className={`h-1 mb-3 ${isOverWordLimit ? '[&>div]:bg-destructive' : ''}`}
              />
            )}
            
            <Textarea
              placeholder="Enter text to paraphrase..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className={`min-h-[250px] sm:min-h-[400px] mb-3 sm:mb-4 ${isOverWordLimit ? 'border-destructive' : ''}`}
              disabled={hasUsedDailyLimit}
            />
            <Button
              onClick={handleParaphrase}
              disabled={isLoading || !inputText.trim() || isOverWordLimit || hasUsedDailyLimit}
              className="w-full h-10 sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Paraphrasing...
                </>
              ) : hasUsedDailyLimit ? (
                "Daily Limit Reached"
              ) : (
                "Paraphrase (1 Credit)"
              )}
            </Button>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold">Paraphrased Output</h2>
              {outputText && (
                <div className="flex gap-2">
                  <Button 
                    variant={canExport ? "outline" : "ghost"} 
                    size="icon" 
                    onClick={handleCopy} 
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${!canExport ? 'opacity-50' : ''}`}
                    title={canExport ? "Copy to clipboard" : "Upgrade to copy"}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={canExport ? "outline" : "ghost"} 
                    size="icon" 
                    onClick={handleDownload} 
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${!canExport ? 'opacity-50' : ''}`}
                    title={canExport ? "Download as TXT" : "Upgrade to download"}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {!canExport && outputText && (
              <div className="mb-3 p-2 bg-muted rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Upgrade to copy or download</span>
              </div>
            )}
            
            <Textarea
              value={outputText}
              readOnly
              placeholder="Paraphrased text will appear here..."
              className="min-h-[250px] sm:min-h-[400px]"
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Paraphraser;
