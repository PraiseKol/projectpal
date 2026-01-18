import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, X, Sparkles, Loader2 } from "lucide-react";

export interface DiffSuggestion {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  type: "grammar" | "clarity" | "style" | "structure" | "content";
}

interface SuggestionsPanelProps {
  suggestions: DiffSuggestion[];
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onApplyAll: () => void;
  isLoading: boolean;
}

const typeColors: Record<DiffSuggestion["type"], string> = {
  grammar: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  clarity: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  style: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  structure: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  content: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const typeLabels: Record<DiffSuggestion["type"], string> = {
  grammar: "Grammar",
  clarity: "Clarity",
  style: "Style",
  structure: "Structure",
  content: "Content",
};

export function SuggestionsPanel({
  suggestions,
  onApply,
  onDismiss,
  onApplyAll,
  isLoading,
}: SuggestionsPanelProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-center">
            Analyzing your document...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-center">
            Type an instruction below to get AI suggestions for your document.
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
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
          <Badge variant="secondary">{suggestions.length} changes</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-4 border border-border rounded-lg space-y-3 bg-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${typeColors[suggestion.type]}`}
                  >
                    {typeLabels[suggestion.type]}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onDismiss(suggestion.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-destructive font-mono text-sm shrink-0">−</span>
                    <span className="text-sm line-through text-muted-foreground break-words">
                      {suggestion.original}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-mono text-sm shrink-0">+</span>
                    <span className="text-sm text-green-600 dark:text-green-400 break-words">
                      {suggestion.replacement}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {suggestion.explanation}
                </p>

                <Button
                  size="sm"
                  onClick={() => onApply(suggestion.id)}
                  className="w-full"
                >
                  <CheckCircle className="h-3 w-3 mr-2" />
                  Apply
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {suggestions.length > 1 && (
          <Button onClick={onApplyAll} className="w-full">
            <CheckCircle className="h-4 w-4 mr-2" />
            Apply All ({suggestions.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
