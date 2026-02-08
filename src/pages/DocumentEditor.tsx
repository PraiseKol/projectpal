import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SuggestionsPanel, DiffSuggestion } from "@/components/DocumentEditor/SuggestionsPanel";
import { AIInstructionInput } from "@/components/DocumentEditor/AIInstructionInput";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { translateError, logError } from "@/utils/errorMessages";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Download, 
  Loader2, 
  Sparkles,
  GraduationCap,
  Trash2,
  Copy,
  CheckCircle
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configure pdf.js worker - use local file to avoid CDN version mismatch
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Helper function to extract text from PDF with enhanced error handling
const extractPdfText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const totalPages = Math.min(pdf.numPages, 100); // Limit to 100 pages
    
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the file is not corrupted.');
  }
};

interface DocumentData {
  id: string;
  file_name: string;
  file_url: string;
  extracted_content: string | null;
  edited_content: string | null;
}

const DocumentEditor = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [currentDocument, setCurrentDocument] = useState<DocumentData | null>(null);
  const [editableContent, setEditableContent] = useState("");
  const [suggestions, setSuggestions] = useState<DiffSuggestion[]>([]);
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"document" | "results">("document");

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

      // Use signed URL instead of public URL for security
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to generate document URL");
      }
      
      const publicUrl = signedUrlData.signedUrl;

      // Extract text content
      let extractedContent = "";
      
      if (file.type === "text/plain") {
        extractedContent = await file.text();
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Parse DOCX using mammoth
        toast.info("Processing DOCX document...");
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedContent = result.value;
          
          if (result.messages.length > 0 && import.meta.env.DEV) {
            console.log("Mammoth warnings:", result.messages);
          }
        } catch (err) {
          logError("DocumentEditor:parseDOCX", err);
          toast.error("Failed to extract text from DOCX. Please try pasting the content manually.");
          extractedContent = "";
        }
      } else if (file.type === "application/pdf") {
        // Extract text from PDF using pdf.js
        toast.info("Processing PDF document...");
        try {
          extractedContent = await extractPdfText(file);
          if (!extractedContent.trim()) {
            toast.warning("Could not extract text. The PDF may be scanned or image-based. Please paste content manually.");
          }
        } catch (err) {
          logError("DocumentEditor:parsePDF", err);
          toast.error("Failed to extract text from PDF. Please try pasting the content manually.");
          extractedContent = "";
        }
      }

      // Save document to database (store file path, not URL)
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: fileName, // Store path for later signed URL generation
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
        edited_content: null,
      });
      setEditableContent(extractedContent);
      setSuggestions([]);

      toast.success("Document uploaded successfully!");

      if (!extractedContent) {
        toast.info("Paste your document text in the editor to analyze it.");
      }

    } catch (error: any) {
      logError("DocumentEditor:upload", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAIRequest = async (instruction: string) => {
    if (!currentDocument || !editableContent.trim()) {
      toast.error("Please add content first");
      return;
    }

    setIsProcessing(true);
    setSuggestions([]);
    setGeneratedContent("");

    try {
      const { data, error } = await supabase.functions.invoke("document-ai-chat", {
        body: {
          instruction,
          documentContent: editableContent,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Handle both edit suggestions and generated content
      if (data.requestType === "generation" && data.generatedContent) {
        setGeneratedContent(data.generatedContent);
        toast.success(`Content generated! (${data.creditsUsed} credits used)`);
      } else if (data.suggestions) {
        setSuggestions(data.suggestions);
        if (data.suggestions.length === 0) {
          toast.info("No suggestions for this instruction. Try a different request.");
        } else {
          toast.success(`Found ${data.suggestions.length} suggestions (${data.creditsUsed} credit used)`);
        }
      }
      
      // Refresh user profile for updated credits
      checkUserAccess();

    } catch (error: any) {
      logError("DocumentEditor:AIRequest", error);
      toast.error(translateError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInsertContent = (content: string) => {
    setEditableContent(prev => prev + "\n\n" + content);
    setGeneratedContent("");
    setActiveTab("document");
    toast.success("Content inserted into document!");
  };

  const handleClearGenerated = () => {
    setGeneratedContent("");
    setActiveTab("document");
  };

  // Auto-switch to results tab when content is generated
  useEffect(() => {
    if (generatedContent) {
      setActiveTab("results");
    }
  }, [generatedContent]);

  const handleApplySuggestion = (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;

    // Find and replace the original text with the replacement
    const newContent = editableContent.replace(suggestion.original, suggestion.replacement);
    
    if (newContent === editableContent) {
      toast.error("Could not find the text to replace. It may have already been changed.");
      // Remove the suggestion anyway
      setSuggestions(prev => prev.filter(s => s.id !== id));
      return;
    }

    setEditableContent(newContent);
    setSuggestions(prev => prev.filter(s => s.id !== id));
    toast.success("Suggestion applied!");
  };

  const handleDismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleApplyAll = () => {
    let newContent = editableContent;
    let appliedCount = 0;

    for (const suggestion of suggestions) {
      const updated = newContent.replace(suggestion.original, suggestion.replacement);
      if (updated !== newContent) {
        newContent = updated;
        appliedCount++;
      }
    }

    setEditableContent(newContent);
    setSuggestions([]);
    toast.success(`Applied ${appliedCount} suggestions!`);
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
      logError("DocumentEditor:exportDocx", error);
      toast.error(translateError(error));
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
      logError("DocumentEditor:exportPdf", error);
      toast.error(translateError(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    setCurrentDocument(null);
    setEditableContent("");
    setSuggestions([]);
  };

  const hasCredits = userProfile && (userProfile.daily_credits > 0 || userProfile.paid_credits > 0);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Document Editor | ProjectPal"
        description="Upload your academic documents for AI-powered analysis and editing. Get grammar, structure, and style improvements."
        keywords="document editor, academic writing, AI editing, grammar check, writing improvement"
      />

      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary to-secondary rounded-lg sm:rounded-xl">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="text-base sm:text-lg font-semibold hidden xs:inline">Document Editor</span>
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs hidden sm:inline-flex">Scholar</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {userProfile && (
              <Badge variant="outline" className="text-xs sm:text-sm">
                {userProfile.daily_credits + userProfile.paid_credits} cr
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {!currentDocument ? (
          /* Upload Section */
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Document Assistant
                </CardTitle>
                <CardDescription>
                  Upload your document and ask the AI to help—generate chapters, create papers, summarize, or anything else
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-4 sm:p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
                          edited_content: null,
                        });
                        setSuggestions([]);
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
          /* Editor Section - AI Chat on Left, Document on Right */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Left: AI Chat & Suggestions Panel */}
            <div className="space-y-4 lg:order-1 order-2">
              <Card className="lg:sticky lg:top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Tell the AI what to do with your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AIInstructionInput
                    onSubmit={handleAIRequest}
                    isLoading={isProcessing}
                    disabled={!hasCredits}
                  />
                </CardContent>
              </Card>

              <div className="lg:max-h-[calc(100vh-22rem)] lg:overflow-y-auto">
                <SuggestionsPanel
                  suggestions={suggestions}
                  generatedContent={generatedContent}
                  onApply={handleApplySuggestion}
                  onDismiss={handleDismissSuggestion}
                  onApplyAll={handleApplyAll}
                  onInsertContent={handleInsertContent}
                  onClearGenerated={handleClearGenerated}
                  isLoading={isProcessing}
                />
              </div>
            </div>

            {/* Right: Document Editor with Tabs */}
            <div className="lg:order-2 order-1">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {currentDocument.file_name}
                      </CardTitle>
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
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "document" | "results")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="document" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Document
                      </TabsTrigger>
                      <TabsTrigger value="results" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Results
                        {generatedContent && (
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">New</Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* Document Tab */}
                    <TabsContent value="document" className="mt-4">
                      <Textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="min-h-[350px] sm:min-h-[450px] font-mono text-sm"
                        placeholder="Your document content will appear here..."
                      />
                    </TabsContent>
                    
                    {/* Results Tab */}
                    <TabsContent value="results" className="mt-4">
                      {generatedContent ? (
                        <div className="space-y-4">
                          <ScrollArea className="h-[350px] sm:h-[450px] border border-border rounded-lg p-4">
                            <MarkdownRenderer 
                              content={generatedContent} 
                              className="prose-sm dark:prose-invert"
                            />
                          </ScrollArea>
                          
                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedContent);
                                toast.success("Copied to clipboard!");
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                            <Button onClick={() => handleInsertContent(generatedContent)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Insert into Document
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[350px] sm:h-[450px] text-center">
                          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            Generated content will appear here
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Use the AI Assistant to generate chapters, papers, summaries, and more
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                  
                  {/* Export buttons - always visible */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
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
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentEditor;
