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
import { ArrowLeft, Upload, FileSpreadsheet, BarChart3, Download, GraduationCap, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { FileUploadStep } from "@/components/DataAnalysis/FileUploadStep";
import { DataPreviewStep } from "@/components/DataAnalysis/DataPreviewStep";
import { AnalysisSelectionStep } from "@/components/DataAnalysis/AnalysisSelectionStep";
import { AnalysisResultsStep } from "@/components/DataAnalysis/AnalysisResultsStep";
import { DataAnalysisSkeleton } from "@/components/skeletons/DataAnalysisSkeleton";
import { TutorialProvider, TutorialOverlay, WelcomeDialog, TutorialTrigger } from "@/components/Tutorial";
import { useTutorial } from "@/hooks/useTutorial";
import { translateError, logError } from "@/utils/errorMessages";

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

// Inner component that uses tutorial context
const DataAnalysisContent = () => {
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

  const { startTutorial } = useTutorial();
  
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
      logError("DataAnalysis:checkAuth", error);
      toast.error(translateError(error));
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
      logError("DataAnalysis:createSession", error);
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
      toast.success(
        response.data.preview
          ? "Your free preview is ready!"
          : `Analysis complete! Used ${response.data.creditsUsed} credits`
      );
      setCurrentStep(4);
      checkAuth();
    } catch (error) {
      logError("DataAnalysis:runAnalysis", error);
      toast.error(translateError(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // An expired paid plan counts as free: credits are kept, but only the free preview is available
  const planExpired = !!profile?.credits_expiry_date && new Date(profile.credits_expiry_date) < new Date();
  const isFreeUser = profile?.plan_type === 'free' || planExpired;
  const availableCredits = (profile?.daily_credits || 0) + (profile?.paid_credits || 0);

  if (isLoading) {
    return <DataAnalysisSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Data Analysis | ProjectPal"
        description="Analyze your survey and questionnaire data with professional statistical methods for Chapter 4."
        keywords="data analysis, statistical analysis, SPSS alternative, survey analysis, academic research"
      />
      
      <TutorialOverlay />
      <WelcomeDialog />
      
      {/* Header — collapses gracefully on narrow screens */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shrink-0">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-base sm:text-lg font-semibold hidden xs:inline">Data Analysis</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <Button variant="ghost" size="sm" onClick={startTutorial} aria-label="Start the tutorial">
              <HelpCircle className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Tutorial</span>
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Credits: <span className="font-medium text-foreground">{availableCredits}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Progress Steps */}
        <TutorialTrigger id="tutorial-progress-indicator">
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
                        w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all
                        ${isComplete ? 'bg-primary border-primary text-primary-foreground' : 
                          isActive ? 'border-primary text-primary' : 
                          'border-muted text-muted-foreground'}
                      `}>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 sm:h-6 sm:w-6" />
                        ) : (
                          <StepIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                        )}
                      </div>
                      <span className={`mt-1 sm:mt-2 text-xs sm:text-sm font-medium text-center ${isActive ? 'text-primary' : 'text-muted-foreground hidden sm:inline'}`}>
                        {step.name}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 sm:mx-4 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TutorialTrigger>

        {/* Free User Notice */}
        {isFreeUser && (
          <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Free preview</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Run any analysis on 1 dataset per month and see your tables and charts for free, with no credits used.
                    Exporting Chapter 4 with APA interpretations is part of the Scholar plan.
                    <Button variant="link" className="p-0 h-auto text-yellow-800 dark:text-yellow-200 underline ml-1" onClick={() => navigate('/pricing')}>
                      See plans
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

// Main component with provider wrapper
const DataAnalysis = () => {
  const [currentStep, setCurrentStep] = useState(1);
  
  return (
    <TutorialProvider currentStage={currentStep}>
      <DataAnalysisContent />
    </TutorialProvider>
  );
};

export default DataAnalysis;
