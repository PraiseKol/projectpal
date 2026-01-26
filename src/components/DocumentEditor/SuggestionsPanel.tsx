import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, X, Sparkles, Loader2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

export interface DiffSuggestion {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  type: "grammar" | "clarity" | "style" | "structure" | "content";
}

interface SuggestionsPanelProps {
  suggestions: DiffSuggestion[];
  generatedContent?: string;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onApplyAll: () => void;
  onInsertContent?: (content: string) => void;
  onClearGenerated?: () => void;
  isLoading: boolean;
}

const typeColors: Record<DiffSuggestion["type"], string> = {
  grammar: "bg-destructive/10 text-destructive border-destructive/20",
  clarity: "bg-primary/10 text-primary border-primary/20",
  style: "bg-secondary/50 text-secondary-foreground border-secondary",
  structure: "bg-accent/50 text-accent-foreground border-accent",
  content: "bg-muted text-muted-foreground border-muted-foreground/20",
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
  generatedContent,
  onApply,
  onDismiss,
  onApplyAll,
  onInsertContent,
  onClearGenerated,
  isLoading,
}: SuggestionsPanelProps) {
  
  const handleCopyContent = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent);
      toast.success("Content copied to clipboard!");
    }
  };

  const handleInsertContent = () => {
    if (generatedContent && onInsertContent) {
      onInsertContent(generatedContent);
      toast.success("Content inserted into document!");
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 sm:h-64 gap-4">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          <p className="text-sm sm:text-base text-muted-foreground text-center">
            Processing your request...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show generated content if available
  if (generatedContent) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Generated Content
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClearGenerated}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden flex flex-col gap-3 sm:gap-4">
          <ScrollArea className="flex-1 pr-2 sm:pr-4">
            <div className="p-3 sm:p-4 border border-border rounded-lg bg-muted/30">
              <pre className="whitespace-pre-wrap text-sm font-sans text-foreground">
                {generatedContent}
              </pre>
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopyContent}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              onClick={handleInsertContent}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Insert at End
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 sm:h-64">
          <p className="text-sm sm:text-base text-muted-foreground text-center px-4">
            Type an instruction below to get AI suggestions or generate new content for your document.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            AI Suggestions
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{suggestions.length} changes</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-3 sm:gap-4">
        <ScrollArea className="flex-1 pr-2 sm:pr-4">
          <div className="space-y-3 sm:space-y-4">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 sm:p-4 border border-border rounded-lg space-y-2 sm:space-y-3 bg-card"
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
                      className="h-8 w-8"
                      onClick={() => onDismiss(suggestion.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-destructive font-mono text-xs sm:text-sm shrink-0">−</span>
                    <span className="text-xs sm:text-sm line-through text-muted-foreground break-words">
                      {suggestion.original}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-mono text-xs sm:text-sm shrink-0">+</span>
                    <span className="text-xs sm:text-sm text-primary break-words">
                      {suggestion.replacement}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {suggestion.explanation}
                </p>

                <Button
                  size="default"
                  onClick={() => onApply(suggestion.id)}
                  className="w-full h-10"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {suggestions.length > 1 && (
          <Button onClick={onApplyAll} className="w-full h-10 sm:h-11">
            <CheckCircle className="h-4 w-4 mr-2" />
            Apply All ({suggestions.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
