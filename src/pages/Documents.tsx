import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, FileText, Download, Eye, Palette, ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DocumentsSkeleton } from "@/components/skeletons/DocumentsSkeleton";

const Documents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCheckingPlan, setIsCheckingPlan] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocUrl, setUploadedDocUrl] = useState("");
  const [generatedPptUrl, setGeneratedPptUrl] = useState("");
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

  const handleGeneratePPT = async () => {
    if (!uploadedDocUrl) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppt", {
        body: { 
          document_url: uploadedDocUrl, 
          theme: selectedTheme,
          include_images: includeImages 
        },
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

      setGeneratedPptUrl(data.ppt_url);
      toast({
        title: "Success!",
        description: "PowerPoint presentation generated successfully.",
      });
    } catch (error: any) {
      console.error("PPT generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate presentation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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
                <h2 className="text-lg font-semibold mb-4">Generate Presentation</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-muted-foreground" />
                    <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Select Theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">🎲 Random Theme</SelectItem>
                        <SelectItem value="academic-blue">📘 Academic Blue</SelectItem>
                        <SelectItem value="professional-teal">🌊 Professional Teal</SelectItem>
                        <SelectItem value="classic-red">🔴 Classic Red-Orange</SelectItem>
                        <SelectItem value="warm-gradient">☀️ Warm Gradient</SelectItem>
                        <SelectItem value="formal-green">🌿 Formal Green</SelectItem>
                        <SelectItem value="modern-purple">💜 Modern Purple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
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
                      {includeImages ? "+2 credits" : ""}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Credit cost: <span className="font-semibold">{includeImages ? 8 : 6} credits</span>
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
                </div>
              </div>
            )}

            {generatedPptUrl && (
              <div className="bg-muted p-4 rounded-xl">
                <h3 className="font-semibold mb-3">Presentation Ready!</h3>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <a href={generatedPptUrl} download>
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
