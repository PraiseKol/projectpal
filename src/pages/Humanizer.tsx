import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const MAX_CHARS = 25000;

const Humanizer = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cost, setCost] = useState(5);
  const [credits, setCredits] = useState<{ daily: number; monthly: number; paid: number; plan: string } | null>(null);

  const wordCount = (text: string) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;
  const isOverCharLimit = inputText.length > MAX_CHARS;

  useEffect(() => {
    (async () => {
      // Live cost from admin settings
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "credit_cost_humanizer");
      if (settings?.[0]) {
        const val = parseInt(settings[0].value, 10);
        if (!isNaN(val)) setCost(val);
      }
      // Current balance so users see what they can afford
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_type, daily_credits, monthly_credits, paid_credits, credits_expiry_date")
        .eq("id", user.id)
        .single();
      if (profile) {
        const expired = profile.credits_expiry_date
          ? new Date(profile.credits_expiry_date) < new Date()
          : true;
        setCredits({
          daily: profile.daily_credits ?? 0,
          monthly: profile.monthly_credits ?? 0,
          paid: profile.plan_type !== "free" && !expired ? profile.paid_credits ?? 0 : 0,
          plan: profile.plan_type,
        });
      }
    })();
  }, []);

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      toast.error("Please paste some text to humanize");
      return;
    }

    setIsLoading(true);
    setOutputText("");

    try {
      const { data, error } = await supabase.functions.invoke("humanize-text", {
        body: { text: inputText.trim() },
      });

      if (error) {
        // Surface the useful body message from non-2xx responses
        const body = (error as any)?.context?.body;
        const msg = body?.error || (error as any)?.message || "Failed to humanize text";
        toast.error(msg);
        if (body?.credits_required) {
          setTimeout(() => navigate("/pricing"), 2000);
        }
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setOutputText(data.humanizedText || "");
      toast.success(`Done! Used ${data.credits_used} credits`);
    } catch (err) {
      console.error("Humanizer error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="AI Humanizer | ProjectPal"
        description="Make AI-generated text sound more natural and human-written while preserving original content."
        keywords="AI humanizer, text humanizer, academic writing, AI detection"
      />

      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">AI Humanizer</h1>
            <Badge variant="secondary" className="text-xs">{cost} Credits</Badge>
            {credits && (
              <Badge variant="outline" className="text-xs">
                You have {credits.plan === "free" ? Math.min(credits.daily, credits.monthly) : credits.daily + credits.paid} credits
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paste Your Text</CardTitle>
            <CardDescription>
              Paste AI-generated text below and click "Humanize" to make it sound more natural.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste your text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className={`min-h-[200px] resize-y ${isOverCharLimit ? "border-destructive" : ""}`}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isOverCharLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {wordCount(inputText)} words • {inputText.length.toLocaleString()}/{MAX_CHARS.toLocaleString()} characters
                {isOverCharLimit && " — over the limit, trim your text"}
              </span>
              <Button
                onClick={handleHumanize}
                disabled={isLoading || !inputText.trim() || isOverCharLimit}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Humanizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Humanize
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        {(outputText || isLoading) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Humanized Result</CardTitle>
                {outputText && (
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed border">
                    {outputText}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {wordCount(outputText)} words
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Humanizer;
