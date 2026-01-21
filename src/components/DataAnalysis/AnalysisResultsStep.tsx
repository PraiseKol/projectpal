import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  RotateCcw, 
  Download, 
  Copy, 
  FileText, 
  BarChart3,
  CheckCircle2,
  Lock
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import type { ColumnConfig, AnalysisResults } from "@/pages/DataAnalysis";

interface AnalysisResultsStepProps {
  results: AnalysisResults;
  columns: ColumnConfig[];
  isFreeUser: boolean;
  onBack: () => void;
  onNewAnalysis: () => void;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

export const AnalysisResultsStep = ({
  results,
  columns,
  isFreeUser,
  onBack,
  onNewAnalysis,
}: AnalysisResultsStepProps) => {
  const [activeTab, setActiveTab] = useState<string>(Object.keys(results)[0] || 'descriptive');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleExport = () => {
    if (isFreeUser) {
      toast.error("Export is available for paid users only");
      return;
    }
    
    // Generate Chapter 4 text
    let exportText = "CHAPTER FOUR\nDATA PRESENTATION, ANALYSIS AND INTERPRETATION\n\n";
    exportText += "4.1 Introduction\n";
    exportText += "This chapter presents the analysis and interpretation of data collected for this study.\n\n";
    
    let sectionNum = 2;
    Object.entries(results).forEach(([key, value]) => {
      if (value && !value.error) {
        exportText += `4.${sectionNum} ${getAnalysisTitle(key)}\n`;
        if (value.interpretation) {
          exportText += value.interpretation + "\n\n";
        }
        sectionNum++;
      }
    });
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chapter4_analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Chapter 4 exported successfully");
  };

  const availableResults = Object.entries(results).filter(([_, value]) => value && !value.error);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Analysis Complete
          </h2>
          <p className="text-muted-foreground">
            {availableResults.length} analysis type(s) completed successfully
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={onNewAnalysis}>
            <RotateCcw className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
          <Button onClick={handleExport} disabled={isFreeUser}>
            {isFreeUser ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Export (Paid)
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Chapter 4
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Results Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          {availableResults.map(([key]) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {getAnalysisTitle(key)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Descriptive Statistics */}
        {results.descriptive && (
          <TabsContent value="descriptive">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Descriptive Statistics</CardTitle>
                    <CardDescription>Summary statistics for numeric variables</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.descriptive.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variable</TableHead>
                        <TableHead className="text-right">N</TableHead>
                        <TableHead className="text-right">Mean</TableHead>
                        <TableHead className="text-right">Median</TableHead>
                        <TableHead className="text-right">Std Dev</TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(results.descriptive)
                        .filter(([key]) => key !== 'interpretation')
                        .map(([variable, stats]: [string, any]) => (
                          <TableRow key={variable}>
                            <TableCell className="font-medium">{variable}</TableCell>
                            <TableCell className="text-right">{stats.count}</TableCell>
                            <TableCell className="text-right">{stats.mean?.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{stats.median?.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{stats.stdDev?.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{stats.min?.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{stats.max?.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {results.descriptive.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.descriptive.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Frequencies */}
        {results.frequencies && (
          <TabsContent value="frequencies">
            <Card>
              <CardHeader>
                <CardTitle>Frequency Analysis</CardTitle>
                <CardDescription>Distribution of responses for each variable</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(results.frequencies).map(([variable, data]: [string, any]) => (
                    <div key={variable} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">{variable}</h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(data.categories).map(([name, stats]: [string, any]) => ({
                                name,
                                value: stats.count,
                                percentage: stats.percentage.toFixed(1)
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percentage }) => `${name}: ${percentage}%`}
                              labelLine={false}
                            >
                              {Object.keys(data.categories).map((_, index) => (
                                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Correlation */}
        {results.correlation_pearson && (
          <TabsContent value="correlation_pearson">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pearson Correlation Analysis</CardTitle>
                    <CardDescription>Correlation matrix between numeric variables</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.correlation_pearson.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        {results.correlation_pearson.variables?.map((v: string) => (
                          <TableHead key={v} className="text-center text-xs">{v}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.correlation_pearson.matrix?.map((row: any[], i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">
                            {results.correlation_pearson.variables[i]}
                          </TableCell>
                          {row.map((cell: any, j: number) => (
                            <TableCell 
                              key={j} 
                              className={`text-center text-xs ${getCorrelationColor(cell.r)}`}
                            >
                              {cell.r?.toFixed(2)}
                              {cell.pValue < 0.05 && <span className="text-primary">*</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <span>* p &lt; 0.05</span>
                  <span className="text-green-600">Strong positive</span>
                  <span className="text-red-600">Strong negative</span>
                </div>

                {results.correlation_pearson.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.correlation_pearson.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* T-Test Independent */}
        {results.ttest_independent && (
          <TabsContent value="ttest_independent">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Independent Samples T-Test</CardTitle>
                    <CardDescription>Comparison between two groups</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.ttest_independent.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">t-value</TableCell>
                          <TableCell>{results.ttest_independent.tValue?.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Degrees of Freedom</TableCell>
                          <TableCell>{results.ttest_independent.df}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">p-value</TableCell>
                          <TableCell>
                            {results.ttest_independent.pValue?.toFixed(4)}
                            {results.ttest_independent.pValue < 0.05 && (
                              <Badge variant="secondary" className="ml-2">Significant</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Mean Difference</TableCell>
                          <TableCell>{results.ttest_independent.meanDiff?.toFixed(3)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  {results.ttest_independent.groupMeans && (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(results.ttest_independent.groupMeans).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {results.ttest_independent.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.ttest_independent.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ANOVA */}
        {results.anova_oneway && (
          <TabsContent value="anova_oneway">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>One-Way ANOVA</CardTitle>
                    <CardDescription>Analysis of variance across groups</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.anova_oneway.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">F-value</TableCell>
                          <TableCell>{results.anova_oneway.fValue?.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">df (between, within)</TableCell>
                          <TableCell>{results.anova_oneway.df1}, {results.anova_oneway.df2}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">p-value</TableCell>
                          <TableCell>
                            {results.anova_oneway.pValue?.toFixed(4)}
                            {results.anova_oneway.pValue < 0.05 && (
                              <Badge variant="secondary" className="ml-2">Significant</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {results.anova_oneway.groupStats && (
                      <Table className="mt-4">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Group</TableHead>
                            <TableHead className="text-right">N</TableHead>
                            <TableHead className="text-right">Mean</TableHead>
                            <TableHead className="text-right">Std Dev</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.anova_oneway.groupStats.map((group: any) => (
                            <TableRow key={group.name}>
                              <TableCell>{group.name}</TableCell>
                              <TableCell className="text-right">{group.n}</TableCell>
                              <TableCell className="text-right">{group.mean?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{group.stdDev?.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  
                  {results.anova_oneway.groupStats && (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.anova_oneway.groupStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="mean" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {results.anova_oneway.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.anova_oneway.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Regression */}
        {results.regression_linear && (
          <TabsContent value="regression_linear">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Multiple Linear Regression</CardTitle>
                    <CardDescription>Predicting {results.regression_linear.dependentVariable}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.regression_linear.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Model Summary</h4>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">R²</TableCell>
                          <TableCell>{results.regression_linear.rSquared?.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Adjusted R²</TableCell>
                          <TableCell>{results.regression_linear.adjustedRSquared?.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">F-statistic</TableCell>
                          <TableCell>{results.regression_linear.fStatistic?.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">F p-value</TableCell>
                          <TableCell>
                            {results.regression_linear.fPValue?.toFixed(4)}
                            {results.regression_linear.fPValue < 0.05 && (
                              <Badge variant="secondary" className="ml-2">Significant</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Sample Size</TableCell>
                          <TableCell>{results.regression_linear.sampleSize}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Coefficients</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variable</TableHead>
                          <TableHead className="text-right">B</TableHead>
                          <TableHead className="text-right">p-value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.regression_linear.coefficients?.map((coef: any) => (
                          <TableRow key={coef.name}>
                            <TableCell>{coef.name}</TableCell>
                            <TableCell className="text-right">{coef.value?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">
                              {coef.pValue?.toFixed(4)}
                              {coef.pValue < 0.05 && <span className="text-primary ml-1">*</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {results.regression_linear.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.regression_linear.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Likert */}
        {results.likert && (
          <TabsContent value="likert">
            <Card>
              <CardHeader>
                <CardTitle>Likert Scale Analysis</CardTitle>
                <CardDescription>Analysis of rating scale responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(results.likert).map(([variable, data]: [string, any]) => (
                    <div key={variable} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">{variable}</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Weighted Mean</TableCell>
                                <TableCell>{data.weightedMean?.toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Mode</TableCell>
                                <TableCell>{data.mode?.join(', ')}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Interpretation</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{data.interpretation}</Badge>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div className="h-[150px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={Object.entries(data.distribution).map(([rating, stats]: [string, any]) => ({
                              rating,
                              count: stats.count,
                              percentage: stats.percentage
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="rating" />
                              <YAxis />
                              <Tooltip formatter={(value, name) => [name === 'percentage' ? `${value}%` : value, name]} />
                              <Bar dataKey="count" fill="hsl(var(--primary))" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

function getAnalysisTitle(key: string): string {
  const titles: Record<string, string> = {
    descriptive: 'Descriptive Statistics',
    frequencies: 'Frequencies',
    likert: 'Likert Scale',
    correlation_pearson: 'Pearson Correlation',
    correlation_spearman: 'Spearman Correlation',
    ttest_independent: 'Independent T-Test',
    ttest_paired: 'Paired T-Test',
    anova_oneway: 'One-Way ANOVA',
    anova_twoway: 'Two-Way ANOVA',
    regression_linear: 'Linear Regression',
    regression_logistic: 'Logistic Regression',
    factor_analysis: 'Factor Analysis',
  };
  return titles[key] || key;
}

function getCorrelationColor(r: number): string {
  if (r >= 0.7) return 'text-green-600 dark:text-green-400 font-semibold';
  if (r >= 0.5) return 'text-green-500 dark:text-green-500';
  if (r <= -0.7) return 'text-red-600 dark:text-red-400 font-semibold';
  if (r <= -0.5) return 'text-red-500 dark:text-red-500';
  return '';
}
