import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, AlertCircle, FileText, BookOpen, Quote, Lightbulb } from "lucide-react";

interface GrammarIssue {
  original: string;
  suggested: string;
  explanation: string;
}

interface AnalysisResult {
  overallScore: number;
  summary: string;
  categories: {
    grammar: {
      score: number;
      issues: GrammarIssue[];
    };
    structure: {
      score: number;
      suggestions: string[];
    };
    academic_style: {
      score: number;
      issues: GrammarIssue[];
    };
    citations: {
      score: number;
      issues: string[];
    };
  };
  improvedText: string;
}

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  onApplyImproved: () => void;
  isLoading?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

const getScoreBadge = (score: number) => {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
};

export function AnalysisPanel({ analysis, onApplyImproved, isLoading }: AnalysisPanelProps) {
  if (!analysis) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-center">
            {isLoading 
              ? "Analyzing your document..." 
              : "Click 'Analyze Document' to get AI feedback"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Score:</span>
            <Badge variant={getScoreBadge(analysis.overallScore)} className="text-lg px-3">
              {analysis.overallScore}/100
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{analysis.summary}</p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
        <ScrollArea className="flex-1">
          <Accordion type="multiple" className="space-y-2">
            {/* Grammar Section */}
            <AccordionItem value="grammar" className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4" />
                  <span>Grammar & Spelling</span>
                  <Badge variant={getScoreBadge(analysis.categories.grammar.score)} className="ml-auto mr-2">
                    {analysis.categories.grammar.score}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {analysis.categories.grammar.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No grammar issues found!</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.categories.grammar.issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-destructive line-through text-sm">{issue.original}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 text-sm">{issue.suggested}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{issue.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Structure Section */}
            <AccordionItem value="structure" className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4" />
                  <span>Structure & Organization</span>
                  <Badge variant={getScoreBadge(analysis.categories.structure.score)} className="ml-auto mr-2">
                    {analysis.categories.structure.score}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {analysis.categories.structure.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Structure looks good!</p>
                ) : (
                  <ul className="space-y-2">
                    {analysis.categories.structure.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Academic Style Section */}
            <AccordionItem value="academic" className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4" />
                  <span>Academic Style</span>
                  <Badge variant={getScoreBadge(analysis.categories.academic_style.score)} className="ml-auto mr-2">
                    {analysis.categories.academic_style.score}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {analysis.categories.academic_style.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Academic style is appropriate!</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.categories.academic_style.issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-destructive line-through text-sm">{issue.original}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 text-sm">{issue.suggested}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{issue.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Citations Section */}
            <AccordionItem value="citations" className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <Quote className="h-4 w-4" />
                  <span>Citations</span>
                  <Badge variant={getScoreBadge(analysis.categories.citations.score)} className="ml-auto mr-2">
                    {analysis.categories.citations.score}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {analysis.categories.citations.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Citations look good!</p>
                ) : (
                  <ul className="space-y-2">
                    {analysis.categories.citations.issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        <Button onClick={onApplyImproved} className="w-full">
          Apply All AI Improvements
        </Button>
      </CardContent>
    </Card>
  );
}