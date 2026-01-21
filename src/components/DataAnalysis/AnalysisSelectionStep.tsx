import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Loader2, Lock, Info, Coins, Sparkles } from "lucide-react";
import type { ColumnConfig } from "@/pages/DataAnalysis";

interface AnalysisSelectionStepProps {
  columns: ColumnConfig[];
  isFreeUser: boolean;
  availableCredits: number;
  selectedAnalyses: string[];
  onSelectionChange: (analyses: string[]) => void;
  onBack: () => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
}

interface AnalysisMethod {
  id: string;
  name: string;
  description: string;
  credits: number;
  category: 'descriptive' | 'comparison' | 'relationship' | 'validation';
  requirements: {
    minNumeric?: number;
    minLikert?: number;
    minCategorical?: number;
    minGroups?: number;
    minSampleSize?: number;
  };
  freeAccess: boolean;
  needsConfig?: 'grouping' | 'dv' | 'iv' | 'paired';
}

const ANALYSIS_METHODS: AnalysisMethod[] = [
  // Descriptive
  {
    id: 'descriptive',
    name: 'Descriptive Statistics',
    description: 'Mean, median, mode, standard deviation for all numeric variables',
    credits: 20,
    category: 'descriptive',
    requirements: { minNumeric: 1 },
    freeAccess: true,
  },
  {
    id: 'frequencies',
    name: 'Frequency Analysis',
    description: 'Count and percentage distribution for each variable',
    credits: 20,
    category: 'descriptive',
    requirements: {},
    freeAccess: true,
  },
  {
    id: 'likert',
    name: 'Likert Scale Analysis',
    description: 'Weighted mean, distribution, and interpretation for rating scales',
    credits: 25,
    category: 'descriptive',
    requirements: { minLikert: 1 },
    freeAccess: false,
  },
  
  // Relationship
  {
    id: 'correlation_pearson',
    name: 'Pearson Correlation',
    description: 'Measure linear relationships between numeric variables',
    credits: 30,
    category: 'relationship',
    requirements: { minNumeric: 2 },
    freeAccess: true,
  },
  {
    id: 'correlation_spearman',
    name: 'Spearman Correlation',
    description: 'Measure relationships for ordinal or non-normal data',
    credits: 30,
    category: 'relationship',
    requirements: { minNumeric: 2 },
    freeAccess: false,
  },
  {
    id: 'regression_linear',
    name: 'Multiple Linear Regression',
    description: 'Predict a numeric outcome from multiple predictors',
    credits: 50,
    category: 'relationship',
    requirements: { minNumeric: 3 },
    freeAccess: false,
    needsConfig: 'iv',
  },
  
  // Comparison
  {
    id: 'ttest_independent',
    name: 'Independent T-Test',
    description: 'Compare means between two different groups',
    credits: 30,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'grouping',
  },
  {
    id: 'ttest_paired',
    name: 'Paired T-Test',
    description: 'Compare means for pre-test/post-test designs',
    credits: 30,
    category: 'comparison',
    requirements: { minNumeric: 2 },
    freeAccess: false,
    needsConfig: 'paired',
  },
  {
    id: 'anova_oneway',
    name: 'One-Way ANOVA',
    description: 'Compare means across 3+ groups',
    credits: 40,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'grouping',
  },
  {
    id: 'anova_twoway',
    name: 'Two-Way ANOVA',
    description: 'Compare means with two independent variables',
    credits: 60,
    category: 'comparison',
    requirements: { minCategorical: 2, minNumeric: 1 },
    freeAccess: false,
  },
  
  // Validation
  {
    id: 'factor_analysis',
    name: 'Factor Analysis (EFA)',
    description: 'Identify underlying constructs in questionnaire items',
    credits: 80,
    category: 'validation',
    requirements: { minLikert: 5, minSampleSize: 100 },
    freeAccess: false,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  descriptive: 'Descriptive & Foundational',
  relationship: 'Relationship & Prediction',
  comparison: 'Group Comparison',
  validation: 'Instrument Validation',
};

export const AnalysisSelectionStep = ({
  columns,
  isFreeUser,
  availableCredits,
  selectedAnalyses,
  onSelectionChange,
  onBack,
  onRunAnalysis,
  isAnalyzing,
}: AnalysisSelectionStepProps) => {
  const [columnConfig, setColumnConfig] = useState<{
    grouping?: number;
    dv?: number;
    ivs?: number[];
    pre?: number;
    post?: number;
  }>({});

  // Count column types
  const columnCounts = useMemo(() => {
    const included = columns.filter(c => c.included);
    return {
      numeric: included.filter(c => c.type === 'numeric').length,
      likert: included.filter(c => c.type === 'likert').length,
      categorical: included.filter(c => c.type === 'categorical').length,
      total: included.length,
    };
  }, [columns]);

  // Check if analysis is compatible
  const isCompatible = (method: AnalysisMethod): boolean => {
    const { requirements } = method;
    const numericTotal = columnCounts.numeric + columnCounts.likert;
    
    if (requirements.minNumeric && numericTotal < requirements.minNumeric) return false;
    if (requirements.minLikert && columnCounts.likert < requirements.minLikert) return false;
    if (requirements.minCategorical && columnCounts.categorical < requirements.minCategorical) return false;
    
    return true;
  };

  // Check if analysis is accessible
  const isAccessible = (method: AnalysisMethod): boolean => {
    if (isFreeUser && !method.freeAccess) return false;
    return isCompatible(method);
  };

  // Toggle analysis selection
  const toggleAnalysis = (id: string) => {
    if (selectedAnalyses.includes(id)) {
      onSelectionChange(selectedAnalyses.filter(a => a !== id));
    } else {
      onSelectionChange([...selectedAnalyses, id]);
    }
  };

  // Calculate total credits
  const totalCredits = useMemo(() => {
    return selectedAnalyses.reduce((sum, id) => {
      const method = ANALYSIS_METHODS.find(m => m.id === id);
      return sum + (method?.credits || 0);
    }, 0);
  }, [selectedAnalyses]);

  // Apply 5% bundle discount if 3+ analyses selected
  const finalCredits = selectedAnalyses.length >= 3 
    ? Math.round(totalCredits * 0.95) 
    : totalCredits;

  const hasEnoughCredits = availableCredits >= finalCredits;

  // Group analyses by category
  const groupedAnalyses = useMemo(() => {
    const groups: Record<string, AnalysisMethod[]> = {};
    ANALYSIS_METHODS.forEach(method => {
      if (!groups[method.category]) groups[method.category] = [];
      groups[method.category].push(method);
    });
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4">
              <Badge variant="outline">{columnCounts.numeric + columnCounts.likert} Numeric</Badge>
              <Badge variant="outline">{columnCounts.likert} Likert</Badge>
              <Badge variant="outline">{columnCounts.categorical} Categorical</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Cost: </span>
                <span className={`font-bold ${!hasEnoughCredits ? 'text-destructive' : 'text-primary'}`}>
                  {finalCredits} credits
                </span>
                {selectedAnalyses.length >= 3 && (
                  <Badge variant="secondary" className="ml-2 text-xs">5% Bundle Discount</Badge>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Available: </span>
                <span className="font-bold">{availableCredits}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Methods */}
      {Object.entries(groupedAnalyses).map(([category, methods]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{CATEGORY_LABELS[category]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {methods.map(method => {
              const compatible = isCompatible(method);
              const accessible = isAccessible(method);
              const selected = selectedAnalyses.includes(method.id);
              const locked = isFreeUser && !method.freeAccess;

              return (
                <div
                  key={method.id}
                  className={`
                    p-4 border rounded-lg transition-all
                    ${!compatible ? 'opacity-50 cursor-not-allowed' : 
                      locked ? 'opacity-70' : 
                      selected ? 'border-primary bg-primary/5' : 
                      'hover:border-primary/50 cursor-pointer'}
                  `}
                  onClick={() => accessible && toggleAnalysis(method.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      disabled={!accessible}
                      onCheckedChange={() => accessible && toggleAnalysis(method.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{method.name}</span>
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Coins className="h-3 w-3" />
                          {method.credits}
                        </Badge>
                        {locked && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Lock className="h-3 w-3" />
                            Paid
                          </Badge>
                        )}
                        {method.freeAccess && isFreeUser && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-400">
                            Free
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                      
                      {!compatible && (
                        <p className="text-xs text-destructive mt-2">
                          <Info className="h-3 w-3 inline mr-1" />
                          {getIncompatibilityReason(method, columnCounts)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onRunAnalysis}
          disabled={selectedAnalyses.length === 0 || !hasEnoughCredits || isAnalyzing}
          className="gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Run Analysis ({finalCredits} credits)
            </>
          )}
        </Button>
      </div>

      {!hasEnoughCredits && selectedAnalyses.length > 0 && (
        <p className="text-center text-sm text-destructive">
          Insufficient credits. You need {finalCredits} credits but have {availableCredits}.
        </p>
      )}
    </div>
  );
};

function getIncompatibilityReason(method: AnalysisMethod, counts: { numeric: number; likert: number; categorical: number }): string {
  const { requirements } = method;
  const numericTotal = counts.numeric + counts.likert;
  
  if (requirements.minNumeric && numericTotal < requirements.minNumeric) {
    return `Requires at least ${requirements.minNumeric} numeric column(s)`;
  }
  if (requirements.minLikert && counts.likert < requirements.minLikert) {
    return `Requires at least ${requirements.minLikert} Likert scale column(s)`;
  }
  if (requirements.minCategorical && counts.categorical < requirements.minCategorical) {
    return `Requires at least ${requirements.minCategorical} categorical column(s) for grouping`;
  }
  if (requirements.minSampleSize) {
    return `Requires at least ${requirements.minSampleSize} respondents`;
  }
  return 'Data requirements not met';
}
