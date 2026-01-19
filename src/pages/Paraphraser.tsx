import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Paraphraser = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPlan, setIsCheckingPlan] = useState(true);

  useEffect(() => {
    checkUserPlan();
  }, []);

  const checkUserPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan_type")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (profile.plan_type !== "scholar") {
        toast({
          title: "Scholar Plan Required",
          description: "This feature is only available for Scholar plan users.",
          variant: "destructive",
        });
        navigate("/pricing");
        return;
      }

      setIsCheckingPlan(false);
    } catch (error) {
      console.error("Error checking plan:", error);
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

    setIsLoading(true);
    setOutputText("");

    try {
      const { data, error } = await supabase.functions.invoke("paraphrase-ai", {
        body: { text: inputText },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setOutputText(data.paraphrased_text);
    } catch (error: any) {
      console.error("Paraphrase error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to paraphrase text",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    toast({
      title: "Copied!",
      description: "Paraphrased text copied to clipboard.",
    });
  };

  const handleDownload = () => {
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

  if (isCheckingPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header - stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="self-start">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">Back to Dashboard</span>
            <span className="xs:hidden">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <h1 className="text-xl sm:text-2xl font-bold">AI Paraphraser</h1>
          </div>
        </div>

        {/* Main content - stacks on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Input Text</h2>
            <Textarea
              placeholder="Enter text to paraphrase..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[250px] sm:min-h-[400px] mb-3 sm:mb-4"
            />
            <Button
              onClick={handleParaphrase}
              disabled={isLoading || !inputText.trim()}
              className="w-full h-10 sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Paraphrasing...
                </>
              ) : (
                "Paraphrase"
              )}
            </Button>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold">Paraphrased Output</h2>
              {outputText && (
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleCopy} className="h-8 w-8 sm:h-9 sm:w-9">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleDownload} className="h-8 w-8 sm:h-9 sm:w-9">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
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