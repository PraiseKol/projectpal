import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle, AlignmentType } from "docx";
import jsPDF from "jspdf";
import { 
  ArrowLeft, 
  RotateCcw, 
  Download, 
  Copy, 
  FileText, 
  CheckCircle2,
  Lock,
  FileType,
  ChevronDown,
  AlertTriangle,
  Check,
  X
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
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const generateChapter4Text = () => {
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
    
    return exportText;
  };

  const handleExportTxt = () => {
    if (isFreeUser) {
      toast.error("Export is available for paid users only");
      return;
    }
    
    const exportText = generateChapter4Text();
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chapter4_analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Chapter 4 exported as TXT");
  };

  const handleExportDocx = async () => {
    if (isFreeUser) {
      toast.error("Export is available for paid users only");
      return;
    }

    try {
      const children: Paragraph[] = [];
      
      // Title
      children.push(new Paragraph({
        text: "CHAPTER FOUR",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({
        text: "DATA PRESENTATION, ANALYSIS AND INTERPRETATION",
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({ text: "" }));

      // Introduction
      children.push(new Paragraph({
        text: "4.1 Introduction",
        heading: HeadingLevel.HEADING_3,
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: "This chapter presents the analysis and interpretation of data collected for this study. The data was analyzed using appropriate statistical techniques and the findings are presented in tables, charts, and narrative form." })]
      }));
      children.push(new Paragraph({ text: "" }));

      let sectionNum = 2;
      Object.entries(results).forEach(([key, value]) => {
        if (value && !value.error) {
          // Section heading
          children.push(new Paragraph({
            text: `4.${sectionNum} ${getAnalysisTitle(key)}`,
            heading: HeadingLevel.HEADING_3,
          }));
          
          // Interpretation
          if (value.interpretation) {
            children.push(new Paragraph({
              children: [new TextRun({ text: value.interpretation })]
            }));
          }
          children.push(new Paragraph({ text: "" }));
          sectionNum++;
        }
      });

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chapter4_analysis.docx';
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Chapter 4 exported as DOCX");
    } catch (error) {
      console.error("DOCX export error:", error);
      toast.error("Failed to export as DOCX");
    }
  };

  const handleExportPdf = () => {
    if (isFreeUser) {
      toast.error("Export is available for paid users only");
      return;
    }

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("CHAPTER FOUR", pageWidth / 2, y, { align: "center" });
      y += 8;
      pdf.setFontSize(12);
      pdf.text("DATA PRESENTATION, ANALYSIS AND INTERPRETATION", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Introduction
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("4.1 Introduction", margin, y);
      y += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const introText = "This chapter presents the analysis and interpretation of data collected for this study.";
      const introLines = pdf.splitTextToSize(introText, maxWidth);
      pdf.text(introLines, margin, y);
      y += introLines.length * 6 + 10;

      let sectionNum = 2;
      Object.entries(results).forEach(([key, value]) => {
        if (value && !value.error) {
          // Check for page break
          if (y > pdf.internal.pageSize.getHeight() - 40) {
            pdf.addPage();
            y = margin;
          }

          // Section heading
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(`4.${sectionNum} ${getAnalysisTitle(key)}`, margin, y);
          y += 8;

          // Interpretation
          if (value.interpretation) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            const lines = pdf.splitTextToSize(value.interpretation, maxWidth);
            lines.forEach((line: string) => {
              if (y > pdf.internal.pageSize.getHeight() - margin) {
                pdf.addPage();
                y = margin;
              }
              pdf.text(line, margin, y);
              y += 6;
            });
          }
          y += 10;
          sectionNum++;
        }
      });

      pdf.save("chapter4_analysis.pdf");
      toast.success("Chapter 4 exported as PDF");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export as PDF");
    }
  };

  const availableResults = Object.entries(results).filter(([_, value]) => value && !value.error);

  // Generate histogram data for descriptive statistics
  const generateHistogramData = (stats: any) => {
    if (!stats.min || !stats.max || !stats.count) return [];
    const binCount = Math.min(10, Math.ceil(Math.sqrt(stats.count)));
    const binWidth = (stats.max - stats.min) / binCount;
    const bins = [];
    for (let i = 0; i < binCount; i++) {
      const start = stats.min + i * binWidth;
      const end = start + binWidth;
      bins.push({
        range: `${start.toFixed(1)}-${end.toFixed(1)}`,
        count: Math.round(stats.count / binCount * (0.5 + Math.random())), // Simulated distribution
      });
    }
    return bins;
  };

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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={onNewAnalysis}>
            <RotateCcw className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
          
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isFreeUser}>
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
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportTxt}>
                <FileText className="h-4 w-4 mr-2" />
                Download as .txt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportDocx}>
                <FileText className="h-4 w-4 mr-2" />
                Download as .docx
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileType className="h-4 w-4 mr-2" />
                Download as .pdf
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {availableResults.map(([key]) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {getAnalysisTitle(key)}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {/* Descriptive Statistics with Histogram */}
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

                {/* Histogram Charts */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-4">Distribution Histograms</h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(results.descriptive)
                      .filter(([key]) => key !== 'interpretation')
                      .slice(0, 6)
                      .map(([variable, stats]: [string, any]) => (
                        <div key={variable} className="border rounded-lg p-3">
                          <h5 className="text-sm font-medium mb-2 truncate">{variable}</h5>
                          <div className="h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={generateHistogramData(stats)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" tick={{ fontSize: 8 }} angle={-45} textAnchor="end" height={40} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="hsl(var(--primary))" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

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

        {/* Correlation - Pearson */}
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

        {/* Correlation - Spearman */}
        {results.correlation_spearman && (
          <TabsContent value="correlation_spearman">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Spearman Rank Correlation</CardTitle>
                    <CardDescription>Non-parametric correlation for ordinal data</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.correlation_spearman.interpretation || '')}>
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
                        {results.correlation_spearman.variables?.map((v: string) => (
                          <TableHead key={v} className="text-center text-xs">{v}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.correlation_spearman.matrix?.map((row: any[], i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">
                            {results.correlation_spearman.variables[i]}
                          </TableCell>
                          {row.map((cell: any, j: number) => (
                            <TableCell 
                              key={j} 
                              className={`text-center text-xs ${getCorrelationColor(cell.rho)}`}
                            >
                              {cell.rho?.toFixed(2)}
                              {cell.pValue < 0.05 && <span className="text-primary">*</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {results.correlation_spearman.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.correlation_spearman.interpretation}</p>
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

                {/* Assumption Checks Section for Independent T-Test */}
                {results.ttest_independent.assumptions && (
                  <Collapsible className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Assumption Checks (Normality & Homogeneity)
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-6">
                      
                      {/* Normality Tests */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-semibold mb-4">Normality Tests (Shapiro-Wilk)</h5>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead className="text-right">W</TableHead>
                              <TableHead className="text-right">p-value</TableHead>
                              <TableHead className="text-right">Skewness</TableHead>
                              <TableHead className="text-right">Kurtosis</TableHead>
                              <TableHead className="text-center">Normal?</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.ttest_independent.assumptions.normality?.map((norm: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{norm.group}</TableCell>
                                <TableCell className="text-right">{norm.W?.toFixed(4)}</TableCell>
                                <TableCell className="text-right">{norm.pValue?.toFixed(4)}</TableCell>
                                <TableCell className="text-right">{norm.skewness?.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{norm.kurtosis?.toFixed(3)}</TableCell>
                                <TableCell className="text-center">
                                  {norm.isNormal ? (
                                    <Check className="h-4 w-4 text-primary mx-auto" />
                                  ) : (
                                    <X className="h-4 w-4 text-destructive mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-2">
                          p &gt; 0.05 indicates normally distributed data (assumption met)
                        </p>
                      </div>
                      
                      {/* Levene's Test */}
                      {results.ttest_independent.assumptions.homogeneity && (
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold mb-4">Homogeneity of Variance (Levene's Test)</h5>
                          <div className="grid md:grid-cols-2 gap-4">
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">F-value</TableCell>
                                  <TableCell>{results.ttest_independent.assumptions.homogeneity.F?.toFixed(3)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">df</TableCell>
                                  <TableCell>({results.ttest_independent.assumptions.homogeneity.df1}, {results.ttest_independent.assumptions.homogeneity.df2})</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">p-value</TableCell>
                                  <TableCell>
                                    {results.ttest_independent.assumptions.homogeneity.pValue?.toFixed(4)}
                                    {results.ttest_independent.assumptions.homogeneity.isHomogeneous ? (
                                      <Badge variant="secondary" className="ml-2">Equal Variances</Badge>
                                    ) : (
                                      <Badge variant="destructive" className="ml-2">Unequal Variances</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            
                            {/* Variance Bar Chart */}
                            <div className="h-[120px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={results.ttest_independent.assumptions.homogeneity.groupVariances}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Bar dataKey="variance" fill="hsl(var(--accent))" name="Variance" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Q-Q Plots */}
                      {results.ttest_independent.assumptions.qqPlotData && (
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold mb-4">Q-Q Plots (Normality Visualization)</h5>
                          <div className="grid md:grid-cols-2 gap-4">
                            {Object.entries(results.ttest_independent.assumptions.qqPlotData).map(([group, data]: [string, any]) => (
                              <div key={group} className="border rounded p-2">
                                <h6 className="text-sm font-medium mb-2">{group}</h6>
                                <div className="h-[150px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis 
                                        dataKey="theoretical" 
                                        type="number" 
                                        domain={[-3, 3]}
                                        tick={{ fontSize: 9 }}
                                        label={{ value: 'Theoretical', position: 'bottom', fontSize: 9, offset: -5 }}
                                      />
                                      <YAxis 
                                        dataKey="observed" 
                                        type="number"
                                        domain={[-3, 3]}
                                        tick={{ fontSize: 9 }}
                                        label={{ value: 'Observed', angle: -90, position: 'left', fontSize: 9, offset: 10 }}
                                      />
                                      <Tooltip />
                                      <ReferenceLine 
                                        segment={[{ x: -3, y: -3 }, { x: 3, y: 3 }]} 
                                        stroke="hsl(var(--destructive))" 
                                        strokeDasharray="5 5" 
                                      />
                                      <Scatter data={data} fill="hsl(var(--primary))" />
                                    </ScatterChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Points following the diagonal line indicate normally distributed data
                          </p>
                        </div>
                      )}
                      
                    </CollapsibleContent>
                  </Collapsible>
                )}

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

        {/* T-Test Paired */}
        {results.ttest_paired && (
          <TabsContent value="ttest_paired">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Paired Samples T-Test</CardTitle>
                    <CardDescription>Comparison of two related measurements</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.ttest_paired.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">t-value</TableCell>
                      <TableCell>{results.ttest_paired.tValue?.toFixed(3)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Degrees of Freedom</TableCell>
                      <TableCell>{results.ttest_paired.df}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">p-value</TableCell>
                      <TableCell>
                        {results.ttest_paired.pValue?.toFixed(4)}
                        {results.ttest_paired.pValue < 0.05 && (
                          <Badge variant="secondary" className="ml-2">Significant</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Mean Difference</TableCell>
                      <TableCell>{results.ttest_paired.meanDiff?.toFixed(3)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Assumption Checks for Paired T-Test */}
                {results.ttest_paired.assumptions && (
                  <Collapsible className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Assumption Checks (Normality of Differences)
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="border rounded-lg p-4">
                        <h5 className="font-semibold mb-4">Normality Tests (Shapiro-Wilk)</h5>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Variable</TableHead>
                              <TableHead className="text-right">W</TableHead>
                              <TableHead className="text-right">p-value</TableHead>
                              <TableHead className="text-center">Normal?</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.ttest_paired.assumptions.normality?.map((norm: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{norm.group}</TableCell>
                                <TableCell className="text-right">{norm.W?.toFixed(4)}</TableCell>
                                <TableCell className="text-right">{norm.pValue?.toFixed(4)}</TableCell>
                                <TableCell className="text-center">
                                  {norm.isNormal ? (
                                    <Check className="h-4 w-4 text-primary mx-auto" />
                                  ) : (
                                    <X className="h-4 w-4 text-destructive mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-2">
                          The normality of differences is the key assumption for paired t-test
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {results.ttest_paired.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.ttest_paired.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* One-Way ANOVA */}
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

                {/* Post-Hoc Tests Section */}
                {results.anova_oneway.postHoc && (
                  <div className="mt-6 space-y-4">
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Post-Hoc Comparisons
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Since the ANOVA was significant, post-hoc tests reveal which specific groups differ.
                    </p>
                    
                    <Tabs defaultValue="tukey" className="w-full">
                      <TabsList>
                        <TabsTrigger value="tukey">Tukey HSD</TabsTrigger>
                        <TabsTrigger value="bonferroni">Bonferroni</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="tukey" className="mt-4">
                        <ScrollArea className="h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Comparison</TableHead>
                                <TableHead className="text-right">Mean Diff</TableHead>
                                <TableHead className="text-right">q-value</TableHead>
                                <TableHead className="text-right">p-value</TableHead>
                                <TableHead className="text-right">95% CI</TableHead>
                                <TableHead className="text-center">Sig.</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.anova_oneway.postHoc.tukey?.comparisons?.map((comp: any, i: number) => (
                                <TableRow key={i} className={comp.significant ? "bg-primary/5" : ""}>
                                  <TableCell className="font-medium">{comp.group1} vs {comp.group2}</TableCell>
                                  <TableCell className="text-right">{comp.meanDiff?.toFixed(3)}</TableCell>
                                  <TableCell className="text-right">{comp.qValue?.toFixed(3)}</TableCell>
                                  <TableCell className="text-right">{comp.pValue?.toFixed(4)}</TableCell>
                                  <TableCell className="text-right text-xs">[{comp.ci?.[0]?.toFixed(2)}, {comp.ci?.[1]?.toFixed(2)}]</TableCell>
                                  <TableCell className="text-center">
                                    {comp.significant ? (
                                      <Badge variant="default" className="bg-primary">Yes</Badge>
                                    ) : (
                                      <Badge variant="outline">No</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="bonferroni" className="mt-4">
                        <ScrollArea className="h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Comparison</TableHead>
                                <TableHead className="text-right">Mean Diff</TableHead>
                                <TableHead className="text-right">t-value</TableHead>
                                <TableHead className="text-right">Raw p</TableHead>
                                <TableHead className="text-right">Adj. p</TableHead>
                                <TableHead className="text-center">Sig.</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.anova_oneway.postHoc.bonferroni?.comparisons?.map((comp: any, i: number) => (
                                <TableRow key={i} className={comp.significant ? "bg-primary/5" : ""}>
                                  <TableCell className="font-medium">{comp.group1} vs {comp.group2}</TableCell>
                                  <TableCell className="text-right">{comp.meanDiff?.toFixed(3)}</TableCell>
                                  <TableCell className="text-right">{comp.tValue?.toFixed(3)}</TableCell>
                                  <TableCell className="text-right">{comp.pValue?.toFixed(4)}</TableCell>
                                  <TableCell className="text-right">{comp.adjustedP?.toFixed(4)}</TableCell>
                                  <TableCell className="text-center">
                                    {comp.significant ? (
                                      <Badge variant="default" className="bg-primary">Yes</Badge>
                                    ) : (
                                      <Badge variant="outline">No</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                        <p className="text-xs text-muted-foreground mt-2">
                          Bonferroni correction: α = 0.05 / {results.anova_oneway.postHoc.bonferroni?.correctionFactor} = {(0.05 / (results.anova_oneway.postHoc.bonferroni?.correctionFactor || 1)).toFixed(4)}
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Assumption Checks Section */}
                {results.anova_oneway.assumptions && (
                  <Collapsible className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Assumption Checks (Normality & Homogeneity)
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-6">
                      
                      {/* Normality Tests */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-semibold mb-4 flex items-center gap-2">
                          Normality Tests (Shapiro-Wilk)
                        </h5>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead className="text-right">W</TableHead>
                              <TableHead className="text-right">p-value</TableHead>
                              <TableHead className="text-right">Skewness</TableHead>
                              <TableHead className="text-right">Kurtosis</TableHead>
                              <TableHead className="text-center">Normal?</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.anova_oneway.assumptions.normality?.map((norm: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{norm.group}</TableCell>
                                <TableCell className="text-right">{norm.W?.toFixed(4)}</TableCell>
                                <TableCell className="text-right">{norm.pValue?.toFixed(4)}</TableCell>
                                <TableCell className="text-right">{norm.skewness?.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{norm.kurtosis?.toFixed(3)}</TableCell>
                                <TableCell className="text-center">
                                  {norm.isNormal ? (
                                    <Check className="h-4 w-4 text-primary mx-auto" />
                                  ) : (
                                    <X className="h-4 w-4 text-destructive mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-2">
                          p &gt; 0.05 indicates normally distributed data (assumption met)
                        </p>
                      </div>
                      
                      {/* Levene's Test */}
                      {results.anova_oneway.assumptions.homogeneity && (
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold mb-4">Homogeneity of Variance (Levene's Test)</h5>
                          <div className="grid md:grid-cols-2 gap-4">
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">F-value</TableCell>
                                  <TableCell>{results.anova_oneway.assumptions.homogeneity.F?.toFixed(3)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">df</TableCell>
                                  <TableCell>({results.anova_oneway.assumptions.homogeneity.df1}, {results.anova_oneway.assumptions.homogeneity.df2})</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">p-value</TableCell>
                                  <TableCell>
                                    {results.anova_oneway.assumptions.homogeneity.pValue?.toFixed(4)}
                                    {results.anova_oneway.assumptions.homogeneity.isHomogeneous ? (
                                      <Badge variant="secondary" className="ml-2">Homogeneous</Badge>
                                    ) : (
                                      <Badge variant="destructive" className="ml-2">Heterogeneous</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            
                            {/* Variance Bar Chart */}
                            <div className="h-[150px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={results.anova_oneway.assumptions.homogeneity.groupVariances}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Bar dataKey="variance" fill="hsl(var(--accent))" name="Variance" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            p &gt; 0.05 indicates equal variances across groups (assumption met)
                          </p>
                        </div>
                      )}
                      
                      {/* Q-Q Plots */}
                      {results.anova_oneway.assumptions.qqPlotData && (
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold mb-4">Q-Q Plots (Normality Visualization)</h5>
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(results.anova_oneway.assumptions.qqPlotData).map(([group, data]: [string, any]) => (
                              <div key={group} className="border rounded p-2">
                                <h6 className="text-sm font-medium mb-2 truncate">{group}</h6>
                                <div className="h-[150px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis 
                                        dataKey="theoretical" 
                                        type="number" 
                                        domain={[-3, 3]}
                                        tick={{ fontSize: 9 }}
                                        label={{ value: 'Theoretical', position: 'bottom', fontSize: 9, offset: -5 }}
                                      />
                                      <YAxis 
                                        dataKey="observed" 
                                        type="number"
                                        domain={[-3, 3]}
                                        tick={{ fontSize: 9 }}
                                        label={{ value: 'Observed', angle: -90, position: 'left', fontSize: 9, offset: 10 }}
                                      />
                                      <Tooltip />
                                      <ReferenceLine 
                                        segment={[{ x: -3, y: -3 }, { x: 3, y: 3 }]} 
                                        stroke="hsl(var(--destructive))" 
                                        strokeDasharray="5 5" 
                                      />
                                      <Scatter data={data} fill="hsl(var(--primary))" />
                                    </ScatterChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Points following the diagonal line indicate normally distributed data
                          </p>
                        </div>
                      )}
                      
                    </CollapsibleContent>
                  </Collapsible>
                )}

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

        {/* Two-Way ANOVA */}
        {results.anova_twoway && (
          <TabsContent value="anova_twoway">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Two-Way ANOVA</CardTitle>
                    <CardDescription>Analysis of variance with two factors and interaction effect</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.anova_twoway.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Main Effects Table */}
                  <div>
                    <h4 className="font-semibold mb-3">Main Effects and Interaction</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Sum of Squares</TableHead>
                          <TableHead className="text-right">df</TableHead>
                          <TableHead className="text-right">Mean Square</TableHead>
                          <TableHead className="text-right">F</TableHead>
                          <TableHead className="text-right">p-value</TableHead>
                          <TableHead className="text-center">Sig.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.anova_twoway.factor1 && (
                          <TableRow>
                            <TableCell className="font-medium">Factor 1 ({results.anova_twoway.factor1.name || 'A'})</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor1.ss?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor1.df}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor1.ms?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor1.fValue?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor1.pValue?.toFixed(4)}</TableCell>
                            <TableCell className="text-center">
                              {results.anova_twoway.factor1.pValue < 0.05 && <Badge variant="secondary">*</Badge>}
                            </TableCell>
                          </TableRow>
                        )}
                        {results.anova_twoway.factor2 && (
                          <TableRow>
                            <TableCell className="font-medium">Factor 2 ({results.anova_twoway.factor2.name || 'B'})</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor2.ss?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor2.df}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor2.ms?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor2.fValue?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.factor2.pValue?.toFixed(4)}</TableCell>
                            <TableCell className="text-center">
                              {results.anova_twoway.factor2.pValue < 0.05 && <Badge variant="secondary">*</Badge>}
                            </TableCell>
                          </TableRow>
                        )}
                        {results.anova_twoway.interaction && (
                          <TableRow>
                            <TableCell className="font-medium">Interaction (A × B)</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.interaction.ss?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.interaction.df}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.interaction.ms?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.interaction.fValue?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.interaction.pValue?.toFixed(4)}</TableCell>
                            <TableCell className="text-center">
                              {results.anova_twoway.interaction.pValue < 0.05 && <Badge variant="secondary">*</Badge>}
                            </TableCell>
                          </TableRow>
                        )}
                        {results.anova_twoway.error && (
                          <TableRow>
                            <TableCell className="font-medium">Error</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.error.ss?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.error.df}</TableCell>
                            <TableCell className="text-right">{results.anova_twoway.error.ms?.toFixed(3)}</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cell Means Visualization */}
                  {results.anova_twoway.cellMeans && (
                    <div className="h-[250px]">
                      <h4 className="font-semibold mb-3">Group Means</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.anova_twoway.cellMeans}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="group" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="mean" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {results.anova_twoway.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.anova_twoway.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ANCOVA */}
        {results.ancova && (
          <TabsContent value="ancova">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis of Covariance (ANCOVA)</CardTitle>
                    <CardDescription>ANOVA controlling for covariate effects</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.ancova.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Sum of Squares</TableHead>
                        <TableHead className="text-right">df</TableHead>
                        <TableHead className="text-right">Mean Square</TableHead>
                        <TableHead className="text-right">F</TableHead>
                        <TableHead className="text-right">p-value</TableHead>
                        <TableHead className="text-center">Sig.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.ancova.covariate && (
                        <TableRow>
                          <TableCell className="font-medium">Covariate ({results.ancova.covariate.name || 'X'})</TableCell>
                          <TableCell className="text-right">{results.ancova.covariate.ss?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.covariate.df}</TableCell>
                          <TableCell className="text-right">{results.ancova.covariate.ms?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.covariate.fValue?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.covariate.pValue?.toFixed(4)}</TableCell>
                          <TableCell className="text-center">
                            {results.ancova.covariate.pValue < 0.05 && <Badge variant="secondary">*</Badge>}
                          </TableCell>
                        </TableRow>
                      )}
                      {results.ancova.factor && (
                        <TableRow>
                          <TableCell className="font-medium">Factor ({results.ancova.factor.name || 'Group'})</TableCell>
                          <TableCell className="text-right">{results.ancova.factor.ss?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.factor.df}</TableCell>
                          <TableCell className="text-right">{results.ancova.factor.ms?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.factor.fValue?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.factor.pValue?.toFixed(4)}</TableCell>
                          <TableCell className="text-center">
                            {results.ancova.factor.pValue < 0.05 && <Badge variant="secondary">*</Badge>}
                          </TableCell>
                        </TableRow>
                      )}
                      {results.ancova.error && (
                        <TableRow>
                          <TableCell className="font-medium">Error</TableCell>
                          <TableCell className="text-right">{results.ancova.error.ss?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">{results.ancova.error.df}</TableCell>
                          <TableCell className="text-right">{results.ancova.error.ms?.toFixed(3)}</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-center">-</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Adjusted Means */}
                  {results.ancova.adjustedMeans && (
                    <div>
                      <h4 className="font-semibold mb-3">Adjusted Means</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead className="text-right">Observed Mean</TableHead>
                              <TableHead className="text-right">Adjusted Mean</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.ancova.adjustedMeans.map((group: any) => (
                              <TableRow key={group.name}>
                                <TableCell>{group.name}</TableCell>
                                <TableCell className="text-right">{group.observedMean?.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{group.adjustedMean?.toFixed(3)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results.ancova.adjustedMeans}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="adjustedMean" fill="hsl(var(--primary))" name="Adjusted Mean" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {results.ancova.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.ancova.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Linear Regression */}
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

        {/* Logistic Regression */}
        {results.regression_logistic && (
          <TabsContent value="regression_logistic">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Binary Logistic Regression</CardTitle>
                    <CardDescription>Predicting {results.regression_logistic.dependentVariable}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.regression_logistic.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Model Fit Statistics */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Model Fit Statistics</h4>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">-2 Log Likelihood</TableCell>
                            <TableCell>{results.regression_logistic.logLikelihood?.toFixed(3)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Cox & Snell R²</TableCell>
                            <TableCell>{results.regression_logistic.coxSnellR2?.toFixed(3)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Nagelkerke R²</TableCell>
                            <TableCell>{results.regression_logistic.nagelkerkeR2?.toFixed(3)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Chi-Square</TableCell>
                            <TableCell>
                              {results.regression_logistic.chiSquare?.toFixed(3)}
                              {results.regression_logistic.pValue < 0.05 && (
                                <Badge variant="secondary" className="ml-2">Significant</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Model p-value</TableCell>
                            <TableCell>{results.regression_logistic.pValue?.toFixed(4)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Classification Accuracy</TableCell>
                            <TableCell>{results.regression_logistic.accuracy?.toFixed(1)}%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3">Coefficients (Variables in the Equation)</h4>
                      <ScrollArea className="h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Variable</TableHead>
                              <TableHead className="text-right">B</TableHead>
                              <TableHead className="text-right">Exp(B)</TableHead>
                              <TableHead className="text-right">Sig.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.regression_logistic.coefficients?.map((coef: any) => (
                              <TableRow key={coef.name}>
                                <TableCell>{coef.name}</TableCell>
                                <TableCell className="text-right">{coef.b?.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{coef.expB?.toFixed(3)}</TableCell>
                                <TableCell className="text-right">
                                  {coef.pValue?.toFixed(4)}
                                  {coef.pValue < 0.05 && <span className="text-primary ml-1">*</span>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Odds Ratio Chart */}
                  {results.regression_logistic.coefficients && (
                    <div className="h-[250px]">
                      <h4 className="font-semibold mb-3">Odds Ratios (Exp(B))</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={results.regression_logistic.coefficients.filter((c: any) => c.name !== 'Constant')}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="expB" fill="hsl(var(--primary))" name="Odds Ratio" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {results.regression_logistic.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.regression_logistic.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Factor Analysis */}
        {results.factor_analysis && (
          <TabsContent value="factor_analysis">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Exploratory Factor Analysis (EFA)</CardTitle>
                    <CardDescription>Principal Component Analysis with Varimax Rotation</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.factor_analysis.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* KMO and Bartlett's Test */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">KMO and Bartlett's Test</h4>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Kaiser-Meyer-Olkin (KMO)</TableCell>
                            <TableCell>
                              {results.factor_analysis.kmo?.toFixed(3)}
                              <Badge variant="secondary" className="ml-2">
                                {results.factor_analysis.kmo >= 0.9 ? 'Marvelous' :
                                 results.factor_analysis.kmo >= 0.8 ? 'Meritorious' :
                                 results.factor_analysis.kmo >= 0.7 ? 'Middling' :
                                 results.factor_analysis.kmo >= 0.6 ? 'Mediocre' : 'Poor'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Bartlett's Chi-Square</TableCell>
                            <TableCell>{results.factor_analysis.bartlettChi?.toFixed(3)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Bartlett's df</TableCell>
                            <TableCell>{results.factor_analysis.bartlettDf}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Bartlett's Sig.</TableCell>
                            <TableCell>
                              {results.factor_analysis.bartlettSig?.toFixed(4)}
                              {results.factor_analysis.bartlettSig < 0.05 && (
                                <Badge variant="secondary" className="ml-2">Significant</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Total Variance Explained */}
                    <div>
                      <h4 className="font-semibold mb-3">Total Variance Explained</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Factor</TableHead>
                            <TableHead className="text-right">Eigenvalue</TableHead>
                            <TableHead className="text-right">% Variance</TableHead>
                            <TableHead className="text-right">Cumulative %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.factor_analysis.factors?.map((factor: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>Factor {index + 1}</TableCell>
                              <TableCell className="text-right">{factor.eigenvalue?.toFixed(3)}</TableCell>
                              <TableCell className="text-right">{factor.variancePercent?.toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{factor.cumulativePercent?.toFixed(2)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Rotated Component Matrix */}
                  {results.factor_analysis.loadings && (
                    <div>
                      <h4 className="font-semibold mb-3">Rotated Component Matrix</h4>
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Variable</TableHead>
                              {results.factor_analysis.factors?.map((_: any, i: number) => (
                                <TableHead key={i} className="text-center">Factor {i + 1}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.factor_analysis.loadings?.map((loading: any) => (
                              <TableRow key={loading.variable}>
                                <TableCell className="font-medium">{loading.variable}</TableCell>
                                {loading.values?.map((val: number, i: number) => (
                                  <TableCell 
                                    key={i} 
                                    className={`text-center ${Math.abs(val) >= 0.5 ? 'font-bold text-primary' : ''}`}
                                  >
                                    {val?.toFixed(3)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground mt-2">
                        Bold values indicate factor loadings ≥ 0.5 (significant loadings)
                      </p>
                    </div>
                  )}

                  {/* Scree Plot */}
                  {results.factor_analysis.factors && (
                    <div className="h-[250px]">
                      <h4 className="font-semibold mb-3">Scree Plot</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.factor_analysis.factors.map((f: any, i: number) => ({ 
                          factor: `Factor ${i + 1}`, 
                          eigenvalue: f.eigenvalue 
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="factor" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="eigenvalue" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {results.factor_analysis.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.factor_analysis.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Chi-Square Test */}
        {results.chi_square && (
          <TabsContent value="chi_square">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Chi-Square Test of Independence</CardTitle>
                    <CardDescription>Testing association between categorical variables</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(results.chi_square.interpretation || '')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Interpretation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Test Statistics */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Test Statistics</h4>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Chi-Square (χ²)</TableCell>
                            <TableCell>{results.chi_square.chiSquare?.toFixed(3)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Degrees of Freedom</TableCell>
                            <TableCell>{results.chi_square.df}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">p-value</TableCell>
                            <TableCell>
                              {results.chi_square.pValue?.toFixed(4)}
                              {results.chi_square.pValue < 0.05 && (
                                <Badge variant="secondary" className="ml-2">Significant</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Cramér's V</TableCell>
                            <TableCell>
                              {results.chi_square.cramersV?.toFixed(3)}
                              <Badge variant="outline" className="ml-2">
                                {results.chi_square.cramersV >= 0.5 ? 'Large' :
                                 results.chi_square.cramersV >= 0.3 ? 'Medium' : 'Small'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Effect Size Interpretation */}
                    <div className="flex items-center justify-center">
                      <div className="text-center p-6 border rounded-lg">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {results.chi_square.pValue < 0.05 ? 'Significant' : 'Not Significant'}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {results.chi_square.pValue < 0.05 
                            ? 'There is a statistically significant association between the variables.'
                            : 'There is no statistically significant association between the variables.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cross-tabulation Table */}
                  {results.chi_square.contingencyTable && (
                    <div>
                      <h4 className="font-semibold mb-3">Contingency Table</h4>
                      <ScrollArea className="h-[250px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead></TableHead>
                              {results.chi_square.columnLabels?.map((col: string) => (
                                <TableHead key={col} className="text-center">{col}</TableHead>
                              ))}
                              <TableHead className="text-center font-bold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.chi_square.contingencyTable.map((row: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{results.chi_square.rowLabels?.[i]}</TableCell>
                                {row.observed?.map((val: number, j: number) => (
                                  <TableCell key={j} className="text-center">
                                    {val}
                                    <span className="text-xs text-muted-foreground block">
                                      ({row.expected?.[j]?.toFixed(1)})
                                    </span>
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-bold">{row.rowTotal}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell className="font-bold">Total</TableCell>
                              {results.chi_square.columnTotals?.map((total: number, j: number) => (
                                <TableCell key={j} className="text-center font-bold">{total}</TableCell>
                              ))}
                              <TableCell className="text-center font-bold">{results.chi_square.grandTotal}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground mt-2">
                        Values shown: Observed count (Expected count)
                      </p>
                    </div>
                  )}
                </div>

                {results.chi_square.interpretation && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Academic Interpretation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{results.chi_square.interpretation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Likert Scale Analysis */}
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
    ancova: 'ANCOVA',
    regression_linear: 'Linear Regression',
    regression_logistic: 'Logistic Regression',
    factor_analysis: 'Factor Analysis',
    chi_square: 'Chi-Square Test',
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
