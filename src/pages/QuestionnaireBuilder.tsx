import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileDown, FileText, Eye, Hammer, RotateCcw, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { QuestionnaireData, createEmptyQuestionnaire } from "@/components/Questionnaire/types";
import { QuestionnaireMetadata } from "@/components/Questionnaire/QuestionnaireMetadata";
import { SectionBuilder } from "@/components/Questionnaire/SectionBuilder";
import { QuestionnairePreview } from "@/components/Questionnaire/QuestionnairePreview";
import { exportToPdf, exportToDocx } from "@/components/Questionnaire/QuestionnaireExport";
import { sampleTemplate } from "@/components/Questionnaire/SampleTemplate";
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

  const handleExportPdf = () => {
    if (!validate()) {
      toast.error("Please fix validation errors before exporting");
      return;
    }
    exportToPdf(data);
    toast.success("PDF downloaded!");
  };

  const handleExportDocx = () => {
    if (!validate()) {
      toast.error("Please fix validation errors before exporting");
      return;
    }
    exportToDocx(data);
    toast.success("DOCX downloaded!");
  };

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
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="default" size="sm" onClick={handleExportDocx}>
              <FileText className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">DOCX</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="builder">
              <Hammer className="h-4 w-4 mr-1.5" /> Builder
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-1.5" /> Preview
            </TabsTrigger>
          </TabsList>

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
            <div className="mb-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4 mr-1" /> Download PDF
              </Button>
              <Button variant="default" size="sm" onClick={handleExportDocx}>
                <FileText className="h-4 w-4 mr-1" /> Download DOCX
              </Button>
            </div>
            <QuestionnairePreview data={data} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default QuestionnaireBuilder;
