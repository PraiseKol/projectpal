import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnalysisPanel } from "@/components/DocumentEditor/AnalysisPanel";
import { SuggestionCard } from "@/components/DocumentEditor/SuggestionCard";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Download, 
  Loader2, 
  Sparkles,
  GraduationCap,
  Trash2
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";

type RewriteType = "grammar" | "clarity" | "academic" | "expand" | "summarize";

interface AnalysisResult {
  overallScore: number;
  summary: string;
  categories: {
    grammar: {
      score: number;
      issues: Array<{ original: string; suggested: string; explanation: string }>;
    };
    structure: {
      score: number;
      suggestions: string[];
    };
    academic_style: {
      score: number;
      issues: Array<{ original: string; suggested: string; explanation: string }>;
    };
    citations: {
      score: number;
      issues: string[];
    };
  };
  improvedText: string;
}

interface DocumentData {
  id: string;
  file_name: string;
  file_url: string;
  extracted_content: string | null;
  ai_analysis: AnalysisResult | null;
  edited_content: string | null;
}

const DocumentEditor = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [currentDocument, setCurrentDocument] = useState<DocumentData | null>(null);
  const [editableContent, setEditableContent] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [rewriteResult, setRewriteResult] = useState<{ rewrittenText: string; explanation: string } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);

  const [userProfile, setUserProfile] = useState<{
    plan_type: string;
    daily_credits: number;
    paid_credits: number;
    credits_expiry_date: string | null;
  } | null>(null);

  useEffect(() => {
    checkUserAccess();
  }, []);

  const checkUserAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type, daily_credits, paid_credits, credits_expiry_date")
      .eq("id", user.id)
      .single();

    if (!profile || profile.plan_type !== "scholar") {
      toast.error("This feature is only available for Scholar plan users");
      navigate("/pricing");
      return;
    }

    // Check expiry
    if (profile.credits_expiry_date) {
      const expiryDate = new Date(profile.credits_expiry_date);
      if (expiryDate < new Date()) {
        toast.error("Your subscription has expired. Please renew to continue.");
        navigate("/pricing?plan=scholar");
        return;
      }
    }

    setUserProfile(profile);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOCX, or TXT file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Extract text content
      let extractedContent = "";
      
      if (file.type === "text/plain") {
        extractedContent = await file.text();
      } else {
        // For PDF and DOCX, we'll use a simplified approach
        // In a real scenario, you'd use a proper parsing library or edge function
        toast.info("Processing document...");
        
        // For now, let the user paste content manually for complex files
        if (file.type === "application/pdf") {
          toast.info("PDF detected. Please paste the text content below for analysis.");
          extractedContent = "";
        } else {
          // Try to read DOCX as text (simplified)
          try {
            const text = await file.text();
            // Extract readable text from DOCX XML
            extractedContent = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          } catch {
            extractedContent = "";
          }
        }
      }

      // Save document to database
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          document_type: "editor",
          extracted_content: extractedContent || null,
        })
        .select()
        .single();

      if (docError) throw docError;

      setCurrentDocument({
        id: docData.id,
        file_name: docData.file_name,
        file_url: docData.file_url,
        extracted_content: extractedContent,
        ai_analysis: null,
        edited_content: null,
      });
      setEditableContent(extractedContent);

      toast.success("Document uploaded successfully!");

      if (!extractedContent) {
        toast.info("Paste your document text in the editor to analyze it.");
      }

    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAnalyze = async () => {
    if (!currentDocument || !editableContent.trim()) {
      toast.error("Please add content to analyze");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Update extracted content if user pasted/edited
      if (editableContent !== currentDocument.extracted_content) {
        await supabase
          .from("documents")
          .update({ extracted_content: editableContent })
          .eq("id", currentDocument.id);
      }

      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: {
          documentContent: editableContent,
          documentId: currentDocument.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCurrentDocument(prev => prev ? {
        ...prev,
        ai_analysis: data.analysis,
      } : null);

      toast.success("Analysis complete!");
      
      // Refresh user profile for updated credits
      checkUserAccess();

    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error(error.message || "Failed to analyze document");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyImproved = () => {
    if (!currentDocument?.ai_analysis?.improvedText) return;
    
    setEditableContent(currentDocument.ai_analysis.improvedText);
    toast.success("AI improvements applied!");
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectedText(text);
      
      // Get selection range in textarea
      const textarea = document.querySelector('textarea');
      if (textarea) {
        setSelectionRange({
          start: textarea.selectionStart,
          end: textarea.selectionEnd
        });
      }
    }
  };

  const handleRewrite = async (type: RewriteType) => {
    if (!selectedText) return;

    setIsRewriting(true);
    setRewriteResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("rewrite-section", {
        body: {
          selectedText,
          rewriteType: type,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setRewriteResult({
        rewrittenText: data.rewrittenText,
        explanation: data.explanation,
      });

      // Refresh user profile for updated credits
      checkUserAccess();

    } catch (error: any) {
      console.error("Rewrite error:", error);
      toast.error(error.message || "Failed to rewrite section");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleApplyRewrite = () => {
    if (!rewriteResult || !selectionRange) return;

    const newContent = 
      editableContent.substring(0, selectionRange.start) + 
      rewriteResult.rewrittenText + 
      editableContent.substring(selectionRange.end);

    setEditableContent(newContent);
    setSelectedText("");
    setRewriteResult(null);
    setSelectionRange(null);
    toast.success("Rewrite applied!");
  };

  const handleCancelRewrite = () => {
    setSelectedText("");
    setRewriteResult(null);
    setSelectionRange(null);
  };

  const exportAsDocx = async () => {
    if (!editableContent) return;

    setIsExporting(true);

    try {
      const paragraphs = editableContent.split('\n').filter(p => p.trim()).map(text => 
        new Paragraph({
          children: [new TextRun({ text, size: 24 })],
          spacing: { after: 200 },
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentDocument?.file_name?.replace(/\.[^.]+$/, '') || 'document'}_edited.docx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Document exported as DOCX!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export document");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPdf = async () => {
    if (!editableContent) return;

    setIsExporting(true);

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      const lines = pdf.splitTextToSize(editableContent, maxWidth);
      let y = margin;
      const lineHeight = 7;

      for (const line of lines) {
        if (y > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      }

      pdf.save(`${currentDocument?.file_name?.replace(/\.[^.]+$/, '') || 'document'}_edited.pdf`);
      toast.success("Document exported as PDF!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export document");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    setCurrentDocument(null);
    setEditableContent("");
    setSelectedText("");
    setRewriteResult(null);
    setSelectionRange(null);
  };

  const hasCredits = userProfile && (userProfile.daily_credits > 0 || userProfile.paid_credits > 0);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Document Editor | ScholarAI Hub"
        description="Upload your academic documents for AI-powered analysis and editing. Get grammar, structure, and style improvements."
        keywords="document editor, academic writing, AI editing, grammar check, writing improvement"
      />

      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Document Editor</span>
              <Badge variant="secondary" className="ml-2">Scholar</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userProfile && (
              <Badge variant="outline" className="text-sm">
                {userProfile.daily_credits + userProfile.paid_credits} credits
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!currentDocument ? (
          /* Upload Section */
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Document Editor
                </CardTitle>
                <CardDescription>
                  Upload your academic document for AI-powered analysis and editing suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isLoading ? (
                    <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  )}
                  <p className="mt-4 text-sm text-muted-foreground">
                    {isLoading ? "Uploading..." : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, or TXT (max 10MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or paste your text
                    </span>
                  </div>
                </div>

                <Textarea
                  placeholder="Paste your document content here..."
                  className="min-h-[200px]"
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                />

                {editableContent && (
                  <Button
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      
                      const { data } = await supabase
                        .from("documents")
                        .insert({
                          user_id: user.id,
                          file_name: "Pasted Document",
                          file_url: "",
                          document_type: "editor",
                          extracted_content: editableContent,
                        })
                        .select()
                        .single();

                      if (data) {
                        setCurrentDocument({
                          id: data.id,
                          file_name: "Pasted Document",
                          file_url: "",
                          extracted_content: editableContent,
                          ai_analysis: null,
                          edited_content: null,
                        });
                      }
                    }}
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Continue with Pasted Text
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Editor Section */
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Editor */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {currentDocument.file_name}
                      </CardTitle>
                      <CardDescription>
                        Select text to get AI rewriting suggestions
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClear}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={editableContent}
                    onChange={(e) => setEditableContent(e.target.value)}
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Your document content will appear here..."
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !editableContent.trim() || !hasCredits}
                      className="flex-1"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze Document (1 credit)
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={exportAsDocx}
                      disabled={isExporting || !editableContent}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      DOCX
                    </Button>

                    <Button
                      variant="outline"
                      onClick={exportAsPdf}
                      disabled={isExporting || !editableContent}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Analysis Panel */}
            <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
              <AnalysisPanel
                analysis={currentDocument.ai_analysis}
                onApplyImproved={handleApplyImproved}
                isLoading={isAnalyzing}
              />
            </div>
          </div>
        )}

        {/* Floating Rewrite Card */}
        <SuggestionCard
          selectedText={selectedText}
          onRewrite={handleRewrite}
          isLoading={isRewriting}
          rewriteResult={rewriteResult}
          onApply={handleApplyRewrite}
          onCancel={handleCancelRewrite}
        />
      </main>
    </div>
  );
};

export default DocumentEditor;