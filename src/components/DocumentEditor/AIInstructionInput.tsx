import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, Wand2, FileText, PenLine, BookOpen, FileSearch, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface AIInstructionInputProps {
  onSubmit: (instruction: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const quickActions = [
  // Fully Wrap Project - NEW (50 credits)
  { 
    label: "Fully Wrap Project", 
    instruction: "Fully wrap this project. Analyze the document content (Chapters 1-5) and generate all preliminary and end-matter sections: Title Page, Certification, Declaration, Dedication, Acknowledgement, Abstract, Table of Contents, List of Tables, List of Figures (before Chapter 1), and References/Bibliography and Appendices (after Chapter 5). Use standard Nigerian university academic format with placeholders where needed.", 
    icon: Sparkles, 
    category: "generate",
    credits: 50 
  },
  // Edit actions (2 credits)
  { 
    label: "Fix Grammar", 
    instruction: "Fix all grammar and spelling errors in this document", 
    icon: PenLine, 
    category: "edit",
    credits: 2 
  },
  { 
    label: "Improve Clarity", 
    instruction: "Improve the clarity and readability of this document", 
    icon: Wand2, 
    category: "edit",
    credits: 2 
  },
  { 
    label: "Academic Tone", 
    instruction: "Make this document more formal and academic in tone", 
    icon: Wand2, 
    category: "edit",
    credits: 2 
  },
  // Analysis actions (4 credits)
  { 
    label: "Summarize", 
    instruction: "Summarize this document in 300-400 words, highlighting the key findings, methodology, and conclusions", 
    icon: FileSearch, 
    category: "analyze",
    credits: 4 
  },
  { 
    label: "Extract Key Points", 
    instruction: "Extract and list all the key points and main arguments from this document", 
    icon: FileSearch, 
    category: "analyze",
    credits: 4 
  },
  // Generation actions
  { 
    label: "Write Abstract", 
    instruction: "Write an academic abstract summarizing this document in 250-300 words. Include the research problem, methodology, key findings, and conclusions.", 
    icon: FileText, 
    category: "generate",
    credits: 5 
  },
  { 
    label: "Write Chapter 5", 
    instruction: "Generate Chapter 5 (Summary, Conclusions, and Recommendations) based on the findings and discussions in this document. Include: Summary of Findings, Conclusions drawn from the research, Recommendations, and Suggestions for Future Research.", 
    icon: FileText, 
    category: "generate",
    credits: 15 
  },
  { 
    label: "Write Introduction", 
    instruction: "Write or improve the Introduction chapter for this document. Include background context, problem statement, research objectives, significance of the study, and chapter outline.", 
    icon: FileText, 
    category: "generate",
    credits: 5 
  },
  { 
    label: "Research Proposal", 
    instruction: "Generate a comprehensive research proposal based on this document. Include: Title, Introduction/Background, Statement of the Problem, Research Objectives, Research Questions/Hypotheses, Significance of the Study, Scope and Limitations, Literature Review outline, Methodology, Expected Results, Timeline, and References.", 
    icon: BookOpen, 
    category: "generate",
    credits: 20 
  },
  { 
    label: "Journal Paper", 
    instruction: "Convert this document into a publishable journal article format. Create sections: Abstract (250 words), Introduction, Methods, Results, Discussion, Conclusion, and References placeholders.", 
    icon: BookOpen, 
    category: "generate",
    credits: 20 
  },
  { 
    label: "Literature Review", 
    instruction: "Generate a Literature Review section based on the themes and topics in this document. Organize by themes, identify gaps, and show how existing research relates to this study.", 
    icon: BookOpen, 
    category: "generate",
    credits: 10 
  },
];

const examplePrompts = [
  "Generate a methodology chapter explaining the research approach",
  "Write recommendations based on my findings",
  "Create an executive summary for non-academic readers",
  "Expand the discussion section with more analysis",
  "Write a research proposal based on this document",
  "Generate a conference presentation outline",
];

export function AIInstructionInput({ onSubmit, isLoading, disabled }: AIInstructionInputProps) {
  const [instruction, setInstruction] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = () => {
    if (!instruction.trim() || isLoading || disabled) return;
    onSubmit(instruction.trim());
    setInstruction("");
    setShowExamples(false);
  };

  const handleQuickAction = (actionInstruction: string) => {
    if (isLoading || disabled) return;
    onSubmit(actionInstruction);
  };

  const handleExampleClick = (example: string) => {
    setInstruction(example);
    setShowExamples(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "edit": return "text-blue-600 dark:text-blue-400";
      case "analyze": return "text-amber-600 dark:text-amber-400";
      case "generate": return "text-emerald-600 dark:text-emerald-400";
      default: return "";
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header with info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">What would you like me to do?</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-7"
            onClick={() => setShowExamples(!showExamples)}
          >
            {showExamples ? "Hide" : "Examples"}
          </Button>
        </div>

        {/* Example prompts */}
        {showExamples && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
            <div className="flex flex-wrap gap-1.5">
              {examplePrompts.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs bg-background hover:bg-primary/10 px-2 py-1 rounded-md border border-border transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions with horizontal scroll */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Quick actions:</p>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.instruction)}
                  disabled={isLoading || disabled}
                  className="text-xs whitespace-nowrap shrink-0 h-8"
                >
                  <action.icon className={`h-3 w-3 mr-1.5 ${getCategoryColor(action.category)}`} />
                  {action.label}
                  <Badge 
                    variant="secondary" 
                    className="ml-1.5 text-[9px] px-1 py-0 h-4"
                  >
                    {action.credits}cr
                  </Badge>
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Custom instruction input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Or type your own request... e.g., 'Generate a methodology chapter' or 'Summarize the key findings' (Ctrl+Enter to send)"
            className="min-h-[80px] sm:min-h-[70px] resize-none flex-1 text-sm"
            disabled={isLoading || disabled}
          />
          <Button
            onClick={handleSubmit}
            disabled={!instruction.trim() || isLoading || disabled}
            className="shrink-0 w-full sm:w-auto h-10 sm:h-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 sm:mr-0 mr-2" />
                <span className="sm:hidden">Send</span>
              </>
            )}
          </Button>
        </div>
        
        {/* Credit info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="text-primary">●</span> Edit: 2cr | 
            <span className="text-secondary-foreground ml-1">●</span> Analyze: 4cr | 
            <span className="text-accent-foreground ml-1">●</span> Generate: 5-50cr
          </span>
        </div>
        
        {disabled && (
          <p className="text-xs text-destructive">
            No credits available. Please upgrade your plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
