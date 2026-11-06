import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, FileText, Download, Eye, ImageIcon, RefreshCw, AlertCircle, LayoutGrid } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DocumentsSkeleton } from "@/components/skeletons/DocumentsSkeleton";
import { ThemeSelector } from "@/components/Documents/ThemeSelector";
import { translateError, logError } from "@/utils/errorMessages";
import { PptPreview, type PptPreviewData } from "@/components/PptPreview";

const Documents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCheckingPlan, setIsCheckingPlan] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocUrl, setUploadedDocUrl] = useState("");
  const [generatedPptUrl, setGeneratedPptUrl] = useState("");
  const [generatedPptName, setGeneratedPptName] = useState<string>("generated-presentation.pptx");
  const [showViewer, setShowViewer] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("random");
  const [includeImages, setIncludeImages] = useState(true);
  const [slideCountRange, setSlideCountRange] = useState("10-12");
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [proTrialUsed, setProTrialUsed] = useState(false);
  const [previewData, setPreviewData] = useState<PptPreviewData | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

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
        .select("plan_type, credits_expiry_date, monthly_free_ppt_used_at")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Everyone can browse the tool and set up a document — only Scholar
      // (or Pro's one-free-deck-per-month trial) can generate. Value is
      // shown before the paywall instead of a redirect.
      const expired = profile.credits_expiry_date
        ? new Date(profile.credits_expiry_date) < new Date()
        : true;
      const used = profile.monthly_free_ppt_used_at ? new Date(profile.monthly_free_ppt_used_at) : null;
      const now = new Date();

      setUserPlan(profile.plan_type);
      setSubscriptionActive(profile.plan_type === "free" ? true : !expired);
      setProTrialUsed(!!used && used.getMonth() === now.getMonth() && used.getFullYear() === now.getFullYear());
      setIsCheckingPlan(false);
    } catch (error) {
      logError("Documents:checkUserPlan", error);
      navigate("/dashboard");
    }
  };

  // Scholar (active) or an active Pro user who hasn't used this month's free deck
  const canGenerate =
    subscriptionActive &&
    (userPlan === "scholar" || (userPlan === "pro" && !proTrialUsed));

  // Free users and expired plans get one on-screen preview per month (proTrialUsed doubles as
  // "this month's allowance is used"). The downloadable file stays a Scholar feature.
  const previewMode = !canGenerate && !(userPlan === "pro" && subscriptionActive);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF, DOC, or DOCX file.",
        variant: "destructive",
      });
      return;
    }

    // A newly selected file fully invalidates the previous upload, output and error,
    // so generation can never run against the old document.
    setSelectedFile(file);
    setUploadedDocUrl("");
    setGeneratedPptUrl("");
    setPreviewData(null);
    setGeneratedPptName("generated-presentation.pptx");
    setGenerationError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Use signed URL instead of public URL for security
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to generate document URL");
      }

      setUploadedDocUrl(signedUrlData.signedUrl);

      // Store the file path (not URL) in database for later signed URL generation
      await supabase.from("documents").insert({
        user_id: user.id,
        file_url: fileName, // Store path, not URL
        file_name: selectedFile.name,
      });

      toast({
        title: "Upload Successful",
        description: "Document uploaded. You can now generate a presentation.",
      });
    } catch (error: any) {
      logError("Documents:upload", error);
      toast({
        title: "Upload Failed",
        description: translateError(error),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGeneratePPT = async () => {
    if (!uploadedDocUrl) return;

    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppt", {
        body: { 
          document_url: uploadedDocUrl, 
          theme: selectedTheme,
          include_images: includeImages,
          slide_count_range: slideCountRange
        },
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes("rate limit") || error.message?.includes("429")) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
        if (error.message?.includes("timeout") || error.message?.includes("504")) {
          throw new Error("The request timed out. Your document may be too large. Try a smaller document.");
        }
        if (error.message?.includes("credits") || error.message?.includes("402")) {
          throw new Error("Insufficient credits. Please upgrade your plan or purchase more credits.");
        }
        throw error;
      }

      if (data?.error) {
        // Parse specific error messages from the edge function
        const errorMsg = data.error.toLowerCase();
        if (errorMsg.includes("credit")) {
          setGenerationError("Insufficient credits. Please upgrade your plan.");
        } else if (errorMsg.includes("document") || errorMsg.includes("parse") || errorMsg.includes("extract")) {
          setGenerationError("Could not read the document. Try uploading a different file format (PDF, DOC, or DOCX).");
        } else if (errorMsg.includes("ai") || errorMsg.includes("model")) {
          setGenerationError("AI service temporarily unavailable. Please try again in a few minutes.");
        } else {
          setGenerationError(data.error);
        }
        toast({
          title: "Generation Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data.preview) {
        setPreviewData({ title: data.title, theme: data.theme, slides: data.slides });
        setProTrialUsed(true);
        toast({
          title: "Your free preview is ready!",
          description: "Upgrade to Scholar to download it as a PowerPoint.",
        });
        return;
      }

       setGeneratedPptUrl(data.ppt_url);
       if (data.download_name) {
         setGeneratedPptName(data.download_name);
       }
      toast({
        title: "Success!",
        description: "PowerPoint presentation generated successfully.",
      });
    } catch (error: any) {
      logError("Documents:generatePPT", error);
      const errorMessage = translateError(error);
      setGenerationError(errorMessage);
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setGenerationError(null);
    handleGeneratePPT();
  };

  if (isCheckingPlan) {
    return <DocumentsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <h1 className="text-lg sm:text-2xl font-bold">PPT Generator</h1>
          </div>
        </div>

        <Card className="p-6 shadow-md rounded-2xl">
          <div className="space-y-6">
            {/* Value preview — shown before the paywall, never after it */}
            {!canGenerate && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
                <h2 className="text-sm font-semibold mb-3">What you'll get — a preview</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3 text-white shadow" style={{ background: "linear-gradient(135deg, #0d9488, #059669)" }}>
                    <p className="text-[10px] uppercase opacity-80">Slide 1</p>
                    <p className="font-bold text-sm mt-1">Chapter One: Introduction</p>
                    <p className="text-[10px] mt-2 opacity-90">Your Name • Your Department</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3 shadow">
                    <p className="text-[10px] text-muted-foreground">Slide 2</p>
                    <p className="font-bold text-sm mt-1">1.1 Background of the Study</p>
                    <p className="text-[10px] mt-2 text-muted-foreground">• Up to 4 clean bullets per slide, never cramped</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Real decks follow your document and selected theme. Set yours up below.
                </p>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a DOC, DOCX, or PDF file to generate a PowerPoint presentation
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Input
                  type="file"
                  accept=".doc,.docx,.pdf"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>

            {uploadedDocUrl && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Number of Slides</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose how many slides your presentation should have
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { value: "7-9", label: "7–9 slides", desc: "Concise" },
                    { value: "10-12", label: "10–12 slides", desc: "Standard" },
                    { value: "13-15", label: "13–15 slides", desc: "Detailed" },
                    { value: "16-21", label: "16–21 slides", desc: "Comprehensive" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSlideCountRange(option.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        slideCountRange === option.value
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <LayoutGrid className={`h-5 w-5 mx-auto mb-1.5 ${
                        slideCountRange === option.value ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </button>
                  ))}
                </div>

                <h2 className="text-lg font-semibold mb-4">Choose Template Style</h2>
                <ThemeSelector
                  selectedTheme={selectedTheme}
                  onThemeSelect={setSelectedTheme}
                />
                
                <div className="mt-6 space-y-4">
                  {previewMode ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      Free preview: see your slides on screen, once a month, with no credits used. The
                      downloadable PowerPoint and AI images come with Scholar.
                    </p>
                  ) : (
                    <>
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <Checkbox 
                      id="include-images" 
                      checked={includeImages}
                      onCheckedChange={(checked) => setIncludeImages(checked as boolean)}
                    />
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <label htmlFor="include-images" className="text-sm font-medium cursor-pointer">
                        Include AI-generated images
                      </label>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {includeImages ? "+5 credits" : ""}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Credit cost: <span className="font-semibold">{includeImages ? 15 : 10} credits</span>
                  </p>
                    </>
                  )}
                  {canGenerate ? (
                    <Button
                      onClick={handleGeneratePPT}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating PowerPoint...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Generate PowerPoint
                        </>
                      )}
                    </Button>
                  ) : previewMode ? (
                    proTrialUsed ? (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 text-center">
                        <h3 className="font-semibold mb-1">You've used this month's free preview</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Upgrade to Scholar to generate and download full presentations.
                        </p>
                        <Button onClick={() => navigate("/pricing")} variant="gradient">See Plans</Button>
                      </div>
                    ) : (
                      <Button onClick={handleGeneratePPT} disabled={isGenerating} className="w-full">
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Preparing your preview...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Generate free preview
                          </>
                        )}
                      </Button>
                    )
                  ) : userPlan === "pro" && subscriptionActive ? (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 text-center">
                      <h3 className="font-semibold mb-1">Your free monthly deck is used</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        You've used your one free PowerPoint this month. Upgrade to Scholar for unlimited generation.
                      </p>
                      <Button onClick={() => navigate("/pricing")} variant="gradient">See Plans</Button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 text-center">
                      <h3 className="font-semibold mb-1">Ready to generate?</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        PowerPoint generation is a Scholar feature.
                      </p>
                      <Button onClick={() => navigate("/pricing")} variant="gradient">See Plans</Button>
                    </div>
                  )}

                  {/* Error display with retry */}
                  {generationError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>{generationError}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="ml-4"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            {previewData && <PptPreview data={previewData} />}

            {generatedPptUrl && (
              <div className="bg-muted p-4 rounded-xl">
                <h3 className="font-semibold mb-3">Presentation Ready!</h3>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <a href={generatedPptUrl} download={generatedPptName}>
                      <Download className="mr-2 h-4 w-4" />
                      Download PowerPoint
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowViewer(true)}
                    className="flex-1"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open in Viewer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Document Viewer Modal */}
        <DocumentViewer
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          url={generatedPptUrl}
          title="Generated Presentation"
          type="pptx"
        />
      </div>
    </div>
  );
};

export default Documents;
