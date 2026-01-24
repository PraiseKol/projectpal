import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SEO } from "@/components/SEO";
import { ArrowLeft, Upload, FileSpreadsheet, BarChart3, Download, GraduationCap, CheckCircle2, AlertCircle } from "lucide-react";
import { FileUploadStep } from "@/components/DataAnalysis/FileUploadStep";
import { DataPreviewStep } from "@/components/DataAnalysis/DataPreviewStep";
import { AnalysisSelectionStep } from "@/components/DataAnalysis/AnalysisSelectionStep";
import { AnalysisResultsStep } from "@/components/DataAnalysis/AnalysisResultsStep";
import { DataAnalysisSkeleton } from "@/components/skeletons/DataAnalysisSkeleton";

export interface ColumnConfig {
  name: string;
  index: number;
  type: 'numeric' | 'likert' | 'categorical';
  included: boolean;
  sampleValues: any[];
  isGrouping?: boolean;
  isSecondaryGrouping?: boolean;
  isDependentVariable?: boolean;
  isIndependentVariable?: boolean;
  isCovariate?: boolean;
  isPre?: boolean;
  isPost?: boolean;
}

export interface AnalysisResults {
  [key: string]: any;
}

const STEPS = [
  { id: 1, name: 'Upload', icon: Upload, description: 'Upload your data file' },
  { id: 2, name: 'Configure', icon: FileSpreadsheet, description: 'Configure columns' },
  { id: 3, name: 'Analyze', icon: BarChart3, description: 'Select analyses' },
  { id: 4, name: 'Results', icon: Download, description: 'View & export' },
];

const DataAnalysis = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data state
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [fileName, setFileName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Analysis state
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileProcessed = async (
    data: any[], 
    columnConfig: ColumnConfig[], 
    name: string
  ) => {
    setRawData(data);
    setColumns(columnConfig);
    setFileName(name);
    
    // Create analysis session
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: session, error } = await supabase
          .from('analysis_sessions')
          .insert({
            user_id: user.id,
            file_name: name,
            raw_data: data,
            column_config: columnConfig as any,
          })
          .select()
          .single();
        
        if (session) {
          setSessionId(session.id);
        }
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
    
    setCurrentStep(2);
  };

  const handleColumnsConfigured = (updatedColumns: ColumnConfig[]) => {
    setColumns(updatedColumns);
    setCurrentStep(3);
  };

  const handleRunAnalysis = async () => {
    if (selectedAnalyses.length === 0) {
      toast.error("Please select at least one analysis");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('data-analysis', {
        body: {
          action: 'run_analysis',
          data: rawData,
          columns: columns.filter(c => c.included),
          analyses: selectedAnalyses,
          sessionId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        toast.error(response.data.error);
        return;
      }

      setAnalysisResults(response.data.results);
      toast.success(`Analysis complete! Used ${response.data.creditsUsed} credits`);
      setCurrentStep(4);
      
      // Refresh profile to show updated credits
      checkAuth();
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isFreeUser = profile?.plan_type === 'free';
  const availableCredits = (profile?.daily_credits || 0) + (profile?.paid_credits || 0);

  if (isLoading) {
    return <DataAnalysisSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Data Analysis | ScholarAI Hub"
        description="Analyze your survey and questionnaire data with professional statistical methods for Chapter 4."
        keywords="data analysis, statistical analysis, SPSS alternative, survey analysis, academic research"
      />
      
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Data Analysis</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Credits: <span className="font-medium text-foreground">{availableCredits}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
                      ${isComplete ? 'bg-primary border-primary text-primary-foreground' : 
                        isActive ? 'border-primary text-primary' : 
                        'border-muted text-muted-foreground'}
                    `}>
                      {isComplete ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`mt-2 text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {step.name}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Free User Notice */}
        {isFreeUser && (
          <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Free Plan Limitations</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    You can analyze 1 dataset per month with Descriptive Statistics and Correlation only. 
                    <Button variant="link" className="p-0 h-auto text-yellow-800 dark:text-yellow-200 underline ml-1" onClick={() => navigate('/pricing')}>
                      Upgrade for full access
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Content */}
        <div className="min-h-[500px]">
          {currentStep === 1 && (
            <FileUploadStep onFileProcessed={handleFileProcessed} />
          )}
          
          {currentStep === 2 && (
            <DataPreviewStep 
              columns={columns}
              rawData={rawData}
              fileName={fileName}
              onBack={() => setCurrentStep(1)}
              onContinue={handleColumnsConfigured}
            />
          )}
          
          {currentStep === 3 && (
            <AnalysisSelectionStep
              columns={columns}
              isFreeUser={isFreeUser}
              availableCredits={availableCredits}
              selectedAnalyses={selectedAnalyses}
              onSelectionChange={setSelectedAnalyses}
              onBack={() => setCurrentStep(2)}
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
            />
          )}
          
          {currentStep === 4 && analysisResults && (
            <AnalysisResultsStep
              results={analysisResults}
              columns={columns}
              isFreeUser={isFreeUser}
              onBack={() => setCurrentStep(3)}
              onNewAnalysis={() => {
                setCurrentStep(1);
                setRawData([]);
                setColumns([]);
                setSelectedAnalyses([]);
                setAnalysisResults(null);
                setFileName("");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default DataAnalysis;
