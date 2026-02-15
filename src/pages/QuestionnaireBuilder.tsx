import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileDown, FileText, Eye, Hammer, RotateCcw, BookOpen, MessageSquare, Lock, Crown, ArrowRight, Loader2, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { QuestionnaireData, createEmptyQuestionnaire } from "@/components/Questionnaire/types";
import { QuestionnaireMetadata } from "@/components/Questionnaire/QuestionnaireMetadata";
import { SectionBuilder } from "@/components/Questionnaire/SectionBuilder";
import { QuestionnairePreview } from "@/components/Questionnaire/QuestionnairePreview";
import { exportToPdf, exportToDocx } from "@/components/Questionnaire/QuestionnaireExport";
import { sampleTemplate } from "@/components/Questionnaire/SampleTemplate";
import { QuestionnaireChat } from "@/components/Questionnaire/QuestionnaireChat";
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

const STORAGE_KEY = "questionnaire_builder_data";

const QuestionnaireBuilder = () => {
  const navigate = useNavigate();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [data, setData] = useState<QuestionnaireData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : createEmptyQuestionnaire();
    } catch {
      return createEmptyQuestionnaire();
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("builder");
  const [planType, setPlanType] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/auth"); return; }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("plan_type, credits_expiry_date")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const isExpired = profile.credits_expiry_date
          ? new Date(profile.credits_expiry_date) < new Date()
          : true;
        const hasAccess = (profile.plan_type === 'pro' || profile.plan_type === 'scholar') && !isExpired;

        if (!hasAccess) {
          toast.error("This feature is available for Pro and Scholar plan users");
          navigate("/pricing");
          return;
        }
        setPlanType(profile.plan_type);
        setIsCheckingAccess(false);
      } catch {
        navigate("/dashboard");
      }
    };
    checkAccess();
  }, [navigate]);

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 500);
    return () => clearTimeout(timer);
  }, [data]);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    if (!data.title.trim()) errs.title = "Title is required";
    if (data.sections.length === 0) errs.sections = "At least one section is required";

    data.sections.forEach((s) => {
      if (!s.title.trim()) errs[`s_${s.id}_title`] = "Section title is required";
      s.questions.forEach((q) => {
        if (!q.text.trim()) errs[`q_${q.id}_text`] = "Question text is required";
        if (!q.type) errs[`q_${q.id}_type`] = "Select a response type";
      });
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [data]);

  const gateExport = async (exportFn: () => Promise<void>, format: string) => {
    if (!validate()) {
      toast.error("Please fix validation errors before exporting");
      return;
    }
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/questionnaire-export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ format }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(err.error || "Insufficient credits", {
            action: { label: "Get Credits", onClick: () => navigate("/pricing") },
          });
        } else {
          toast.error(err.error || "Export failed");
        }
        return;
      }

      await exportFn();
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Something went wrong during export");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => gateExport(() => exportToPdf(data), "pdf");
  const handleExportDocx = () => gateExport(() => exportToDocx(data), "docx");

  const handleReset = () => {
    setData(createEmptyQuestionnaire());
    setErrors({});
    localStorage.removeItem(STORAGE_KEY);
    setShowResetDialog(false);
    toast.success("Questionnaire reset");
  };

  const handleLoadSample = () => {
    setData(sampleTemplate);
    setErrors({});
    setShowSampleDialog(false);
    toast.success("Sample template loaded");
  };

  if (isCheckingAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Questionnaire Builder | ProjectPal"
        description="Design and export professional questionnaires with multiple question types."
      />

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new questionnaire?</AlertDialogTitle>
            <AlertDialogDescription>This will clear all current data. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSampleDialog} onOpenChange={setShowSampleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load sample template?</AlertDialogTitle>
            <AlertDialogDescription>This will replace your current questionnaire with a sample template.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadSample}>Load Sample</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-lg font-bold hidden sm:block">Questionnaire Builder</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSampleDialog(true)}>
              <BookOpen className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Sample</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowResetDialog(true)}>
              <RotateCcw className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">New</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1" /> : <FileDown className="h-4 w-4 sm:mr-1" />} <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="default" size="sm" onClick={handleExportDocx} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1" /> : <FileText className="h-4 w-4 sm:mr-1" />} <span className="hidden sm:inline">DOCX</span>
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 flex items-center justify-center gap-1 py-1 border-t border-border text-xs text-muted-foreground">
          <Coins className="h-3 w-3" /> Export costs 5 credits per download
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="ai-assistant">
              <MessageSquare className="h-4 w-4 mr-1.5" /> AI Assistant
              {planType !== 'scholar' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  <Crown className="h-3 w-3 mr-0.5" /> Scholar
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="builder">
              <Hammer className="h-4 w-4 mr-1.5" /> Builder
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-1.5" /> Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-assistant">
            {planType === 'scholar' ? (
              <QuestionnaireChat
                currentQuestionnaire={data}
                onQuestionnaireGenerated={(newData) => {
                  setData(newData);
                  setErrors({});
                  toast.success("Questionnaire updated from AI!");
                }}
              />
            ) : (
              <Card className="max-w-md mx-auto mt-8">
                <CardContent className="flex flex-col items-center text-center py-10 space-y-4">
                  <div className="p-3 rounded-full bg-muted">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Scholar Plan Feature</h3>
                  <p className="text-muted-foreground text-sm">
                    The AI Assistant helps you generate and refine questionnaires using natural language. Upgrade to the Scholar plan to unlock this feature.
                  </p>
                  <Button variant="gradient" onClick={() => navigate("/pricing?plan=scholar")} className="gap-2">
                    <Crown className="h-4 w-4" /> Upgrade to Scholar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questionnaire Details</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionnaireMetadata data={data} onChange={setData} errors={errors} />
              </CardContent>
            </Card>

            <SectionBuilder
              sections={data.sections}
              onChange={(sections) => setData({ ...data, sections })}
              errors={errors}
            />
          </TabsContent>

          <TabsContent value="preview">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> 5 credits per export</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />} Download PDF
                </Button>
                <Button variant="default" size="sm" onClick={handleExportDocx} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />} Download DOCX
                </Button>
              </div>
            </div>
            <QuestionnairePreview data={data} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default QuestionnaireBuilder;
