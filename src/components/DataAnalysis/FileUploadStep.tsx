import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TutorialTrigger } from "@/components/Tutorial";
import type { ColumnConfig } from "@/pages/DataAnalysis";

interface FileUploadStepProps {
  onFileProcessed: (data: any[], columns: ColumnConfig[], fileName: string) => void;
}

export const FileUploadStep = ({ onFileProcessed }: FileUploadStepProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(file.type) && !['xlsx', 'xls', 'csv'].includes(extension || '')) {
      toast.error("Please upload an Excel (.xlsx) or CSV file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      // Read file as base64
      const base64 = await fileToBase64(file);
      
      // Send to edge function for parsing
      const response = await supabase.functions.invoke('data-analysis', {
        body: {
          action: 'parse_data',
          data: base64,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const { columnConfig, preview, rowCount } = response.data;
      
      toast.success(`File loaded: ${rowCount} rows, ${columnConfig.length} columns`);
      onFileProcessed(preview, columnConfig, file.name);
    } catch (error) {
      console.error('File processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Upload Your Data</CardTitle>
        <CardDescription>
          Upload your survey or questionnaire results in Excel (.xlsx) or CSV format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TutorialTrigger id="tutorial-upload-dropzone">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center transition-all
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
            `}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium">Processing {selectedFile?.name}...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Detecting columns and data types
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <FileSpreadsheet className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="px-3 py-1 bg-muted rounded-full text-xs font-medium">.xlsx</span>
                    <span className="px-3 py-1 bg-muted rounded-full text-xs font-medium">.csv</span>
                  </div>
                </div>
              )}
            </label>
          </div>
        </TutorialTrigger>

        <TutorialTrigger id="tutorial-upload-tips">
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>First row should contain column headers (variable names)</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Each row represents one respondent's data</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Maximum file size: 10MB</span>
            </div>
          </div>
        </TutorialTrigger>
      </CardContent>
    </Card>
  );
};
