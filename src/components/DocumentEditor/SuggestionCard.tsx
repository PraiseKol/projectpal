import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Loader2 } from "lucide-react";

type RewriteType = "grammar" | "clarity" | "academic" | "expand" | "summarize";

interface SuggestionCardProps {
  selectedText: string;
  onRewrite: (type: RewriteType) => void;
  isLoading: boolean;
  rewriteResult: { rewrittenText: string; explanation: string } | null;
  onApply: () => void;
  onCancel: () => void;
}

const rewriteOptions: { type: RewriteType; label: string; description: string }[] = [
  { type: "grammar", label: "Fix Grammar", description: "Correct errors" },
  { type: "clarity", label: "Improve Clarity", description: "Make clearer" },
  { type: "academic", label: "Academic Tone", description: "More formal" },
  { type: "expand", label: "Expand", description: "Add detail" },
  { type: "summarize", label: "Summarize", description: "Make concise" },
];

export function SuggestionCard({
  selectedText,
  onRewrite,
  isLoading,
  rewriteResult,
  onApply,
  onCancel,
}: SuggestionCardProps) {
  if (!selectedText) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-xl z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            AI Rewrite
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            1 credit
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!rewriteResult ? (
          <>
            <p className="text-xs text-muted-foreground line-clamp-2">
              "{selectedText}"
            </p>
            <div className="flex flex-wrap gap-2">
              {rewriteOptions.map((option) => (
                <Button
                  key={option.type}
                  variant="outline"
                  size="sm"
                  onClick={() => onRewrite(option.type)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  {option.label}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-xs">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{rewriteResult.explanation}</p>
              <div className="p-2 bg-muted rounded text-sm">
                {rewriteResult.rewrittenText}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onApply} className="flex-1">
                Apply
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}