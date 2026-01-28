import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, FileText, Download, Eye, ImageIcon, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DocumentsSkeleton } from "@/components/skeletons/DocumentsSkeleton";
import { ThemeSelector } from "@/components/Documents/ThemeSelector";
import { translateError } from "@/utils/errorMessages";

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

    setSelectedFile(file);
    setGeneratedPptUrl("");
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
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
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
          include_images: includeImages 
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

       setGeneratedPptUrl(data.ppt_url);
       if (data.download_name) {
         setGeneratedPptName(data.download_name);
       }
      toast({
        title: "Success!",
        description: "PowerPoint presentation generated successfully.",
      });
    } catch (error: any) {
      console.error("PPT generation error:", error);
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
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <h1 className="text-2xl font-bold">PPT Generator</h1>
          </div>
        </div>

        <Card className="p-6 shadow-md rounded-2xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a DOC, DOCX, or PDF file to generate a PowerPoint presentation
              </p>
              <div className="flex gap-4">
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
                <h2 className="text-lg font-semibold mb-4">Choose Template Style</h2>
                <ThemeSelector
                  selectedTheme={selectedTheme}
                  onThemeSelect={setSelectedTheme}
                />
                
                <div className="mt-6 space-y-4">
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
                    Credit cost: <span className="font-semibold">{includeImages ? 20 : 15} credits</span>
                  </p>
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
