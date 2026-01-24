import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Lock, Info, Coins, Sparkles, Settings2 } from "lucide-react";
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
  onColumnsUpdate?: (columns: ColumnConfig[]) => void;
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
  needsConfig?: 'grouping' | 'dv' | 'iv' | 'paired' | 'twoway' | 'ancova' | 'chi';
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
  {
    id: 'regression_logistic',
    name: 'Logistic Regression',
    description: 'Predict binary outcomes (Yes/No, Pass/Fail)',
    credits: 60,
    category: 'relationship',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'iv',
  },
  
  // Comparison - Parametric
  {
    id: 'ttest_independent',
    name: 'Independent T-Test',
    description: 'Compare means between two different groups (assumes normality)',
    credits: 30,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'grouping',
  },
  {
    id: 'ttest_paired',
    name: 'Paired T-Test',
    description: 'Compare means for pre-test/post-test designs (assumes normality)',
    credits: 30,
    category: 'comparison',
    requirements: { minNumeric: 2 },
    freeAccess: false,
    needsConfig: 'paired',
  },
  // Non-parametric alternatives
  {
    id: 'mannwhitney_u',
    name: 'Mann-Whitney U Test',
    description: 'Non-parametric alternative to independent t-test for non-normal data',
    credits: 30,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'grouping',
  },
  {
    id: 'wilcoxon_signed_rank',
    name: 'Wilcoxon Signed-Rank Test',
    description: 'Non-parametric alternative to paired t-test for non-normal data',
    credits: 30,
    category: 'comparison',
    requirements: { minNumeric: 2 },
    freeAccess: false,
    needsConfig: 'paired',
  },
  {
    id: 'kruskal_wallis',
    name: 'Kruskal-Wallis H Test',
    description: 'Non-parametric alternative to one-way ANOVA for non-normal data',
    credits: 40,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'grouping',
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
    description: 'Compare means with two independent variables + interaction',
    credits: 60,
    category: 'comparison',
    requirements: { minCategorical: 2, minNumeric: 1 },
    freeAccess: false,
    needsConfig: 'twoway',
  },
  {
    id: 'ancova',
    name: 'ANCOVA',
    description: 'Compare groups while controlling for a covariate',
    credits: 60,
    category: 'comparison',
    requirements: { minCategorical: 1, minNumeric: 2 },
    freeAccess: false,
    needsConfig: 'ancova',
  },
  {
    id: 'chi_square',
    name: 'Chi-Square Test',
    description: 'Test independence between categorical variables',
    credits: 30,
    category: 'comparison',
    requirements: { minCategorical: 2 },
    freeAccess: false,
    needsConfig: 'chi',
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
  onColumnsUpdate,
}: AnalysisSelectionStepProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configType, setConfigType] = useState<string | null>(null);
  const [configAnalysisId, setConfigAnalysisId] = useState<string | null>(null);

  // Local column state for configuration
  const [localColumns, setLocalColumns] = useState(columns);

  // Count column types
  const columnCounts = useMemo(() => {
    const included = localColumns.filter(c => c.included);
    return {
      numeric: included.filter(c => c.type === 'numeric').length,
      likert: included.filter(c => c.type === 'likert').length,
      categorical: included.filter(c => c.type === 'categorical').length,
      total: included.length,
    };
  }, [localColumns]);

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

  // Check if analysis needs configuration
  const needsConfiguration = (method: AnalysisMethod): boolean => {
    return !!method.needsConfig;
  };

  // Check if configuration is complete
  const isConfigured = (method: AnalysisMethod): boolean => {
    if (!method.needsConfig) return true;
    
    switch (method.needsConfig) {
      case 'grouping':
        return localColumns.some(c => c.isGrouping) && localColumns.some(c => c.isDependentVariable);
      case 'dv':
        return localColumns.some(c => c.isDependentVariable);
      case 'iv':
        return localColumns.some(c => c.isDependentVariable) && localColumns.some(c => c.isIndependentVariable);
      case 'paired':
        return localColumns.some(c => c.isPre) && localColumns.some(c => c.isPost);
      case 'twoway':
        return localColumns.some(c => c.isGrouping) && localColumns.some(c => c.isSecondaryGrouping) && localColumns.some(c => c.isDependentVariable);
      case 'ancova':
        return localColumns.some(c => c.isGrouping) && localColumns.some(c => c.isCovariate) && localColumns.some(c => c.isDependentVariable);
      case 'chi':
        return localColumns.some(c => c.isGrouping) && localColumns.some(c => c.isSecondaryGrouping);
      default:
        return true;
    }
  };

  // Open config dialog
  const openConfigDialog = (method: AnalysisMethod) => {
    setConfigType(method.needsConfig || null);
    setConfigAnalysisId(method.id);
    setConfigDialogOpen(true);
  };

  // Update column configuration
  const updateColumnConfig = (index: number, field: string, value: boolean) => {
    setLocalColumns(prev => prev.map((col, i) => {
      if (i === index) {
        return { ...col, [field]: value };
      }
      // For single-selection fields, clear others
      if (value && ['isDependentVariable', 'isGrouping', 'isSecondaryGrouping', 'isCovariate', 'isPre', 'isPost'].includes(field)) {
        if (field === 'isIndependentVariable') return col; // Allow multiple IVs
        return { ...col, [field]: false };
      }
      return col;
    }));
  };

  // Save configuration
  const saveConfig = () => {
    if (onColumnsUpdate) {
      onColumnsUpdate(localColumns);
    }
    setConfigDialogOpen(false);
    
    // Auto-select the analysis if not already selected
    if (configAnalysisId && !selectedAnalyses.includes(configAnalysisId)) {
      onSelectionChange([...selectedAnalyses, configAnalysisId]);
    }
  };

  // Toggle analysis selection
  const toggleAnalysis = (method: AnalysisMethod) => {
    const id = method.id;
    if (selectedAnalyses.includes(id)) {
      onSelectionChange(selectedAnalyses.filter(a => a !== id));
    } else {
      if (method.needsConfig && !isConfigured(method)) {
        openConfigDialog(method);
      } else {
        onSelectionChange([...selectedAnalyses, id]);
      }
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

  // Get config dialog title
  const getConfigTitle = (): string => {
    switch (configType) {
      case 'grouping': return 'Configure Grouping & Dependent Variable';
      case 'iv': return 'Configure Variables for Regression';
      case 'paired': return 'Configure Pre/Post Variables';
      case 'twoway': return 'Configure Two-Way ANOVA Variables';
      case 'ancova': return 'Configure ANCOVA Variables';
      case 'chi': return 'Configure Chi-Square Variables';
      default: return 'Configure Analysis';
    }
  };

  // Helper functions for select components
  const numericColumns = localColumns.filter(c => c.type === 'numeric' || c.type === 'likert');
  const categoricalColumns = localColumns.filter(c => c.type === 'categorical');

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
              const configured = isConfigured(method);
              const hasConfig = needsConfiguration(method);

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
                  onClick={() => accessible && toggleAnalysis(method)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      disabled={!accessible}
                      onCheckedChange={() => accessible && toggleAnalysis(method)}
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
                        {hasConfig && selected && configured && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            Configured
                          </Badge>
                        )}
                        {hasConfig && selected && !configured && (
                          <Badge variant="outline" className="text-xs text-amber-600">
                            Needs Setup
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
                    
                    {hasConfig && accessible && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfigDialog(method);
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    )}
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
          onClick={() => {
            if (onColumnsUpdate) onColumnsUpdate(localColumns);
            onRunAnalysis();
          }}
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

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getConfigTitle()}</DialogTitle>
            <DialogDescription>
              Select the variables for this analysis
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {(configType === 'grouping' || configType === 'twoway' || configType === 'ancova' || configType === 'chi') && (
              <div className="space-y-2">
                <Label>Grouping Variable (Factor 1)</Label>
                <Select
                  value={localColumns.find(c => c.isGrouping)?.index.toString() || ''}
                  onValueChange={(val) => {
                    const idx = parseInt(val);
                    setLocalColumns(prev => prev.map((col, i) => ({
                      ...col,
                      isGrouping: i === idx
                    })));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grouping variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoricalColumns.map(col => (
                      <SelectItem key={col.index} value={col.index.toString()}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(configType === 'twoway' || configType === 'chi') && (
              <div className="space-y-2">
                <Label>Second Grouping Variable (Factor 2)</Label>
                <Select
                  value={localColumns.find(c => c.isSecondaryGrouping)?.index.toString() || ''}
                  onValueChange={(val) => {
                    const idx = parseInt(val);
                    setLocalColumns(prev => prev.map((col, i) => ({
                      ...col,
                      isSecondaryGrouping: i === idx
                    })));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select second factor" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoricalColumns.filter(c => !c.isGrouping).map(col => (
                      <SelectItem key={col.index} value={col.index.toString()}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(configType === 'grouping' || configType === 'iv' || configType === 'twoway' || configType === 'ancova') && (
              <div className="space-y-2">
                <Label>Dependent Variable (Outcome)</Label>
                <Select
                  value={localColumns.find(c => c.isDependentVariable)?.index.toString() || ''}
                  onValueChange={(val) => {
                    const idx = parseInt(val);
                    setLocalColumns(prev => prev.map((col, i) => ({
                      ...col,
                      isDependentVariable: i === idx
                    })));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dependent variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericColumns.map(col => (
                      <SelectItem key={col.index} value={col.index.toString()}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {configType === 'iv' && (
              <div className="space-y-2">
                <Label>Independent Variables (Predictors)</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {numericColumns.filter(c => !c.isDependentVariable).map(col => (
                    <div key={col.index} className="flex items-center gap-2">
                      <Checkbox
                        checked={col.isIndependentVariable || false}
                        onCheckedChange={(checked) => updateColumnConfig(col.index, 'isIndependentVariable', !!checked)}
                      />
                      <span className="text-sm">{col.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {configType === 'ancova' && (
              <div className="space-y-2">
                <Label>Covariate (Control Variable)</Label>
                <Select
                  value={localColumns.find(c => c.isCovariate)?.index.toString() || ''}
                  onValueChange={(val) => {
                    const idx = parseInt(val);
                    setLocalColumns(prev => prev.map((col, i) => ({
                      ...col,
                      isCovariate: i === idx
                    })));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select covariate" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericColumns.filter(c => !c.isDependentVariable).map(col => (
                      <SelectItem key={col.index} value={col.index.toString()}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {configType === 'paired' && (
              <>
                <div className="space-y-2">
                  <Label>Pre-Test Variable</Label>
                  <Select
                    value={localColumns.find(c => c.isPre)?.index.toString() || ''}
                    onValueChange={(val) => {
                      const idx = parseInt(val);
                      setLocalColumns(prev => prev.map((col, i) => ({
                        ...col,
                        isPre: i === idx
                      })));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pre-test variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {numericColumns.map(col => (
                        <SelectItem key={col.index} value={col.index.toString()}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Post-Test Variable</Label>
                  <Select
                    value={localColumns.find(c => c.isPost)?.index.toString() || ''}
                    onValueChange={(val) => {
                      const idx = parseInt(val);
                      setLocalColumns(prev => prev.map((col, i) => ({
                        ...col,
                        isPost: i === idx
                      })));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select post-test variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {numericColumns.filter(c => !c.isPre).map(col => (
                        <SelectItem key={col.index} value={col.index.toString()}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig}>
              Save & Select Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
