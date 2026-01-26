import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, Wand2, FileText, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AIInstructionInputProps {
  onSubmit: (instruction: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const editActions = [
  { label: "Fix Grammar", instruction: "Fix all grammar and spelling errors in this document", icon: PenLine },
  { label: "Improve Clarity", instruction: "Improve the clarity and readability of this document", icon: Wand2 },
  { label: "Academic Tone", instruction: "Make this document more formal and academic in tone", icon: Wand2 },
  { label: "Simplify", instruction: "Simplify complex sentences and make the text easier to understand", icon: Wand2 },
];

const generateActions = [
  { label: "Write Chapter 5", instruction: "Generate Chapter 5 (Summary, Conclusions, and Recommendations) based on the findings and discussions in this document", icon: FileText },
  { label: "Write Abstract", instruction: "Write an academic abstract summarizing this document in 250-300 words", icon: FileText },
  { label: "Write Summary", instruction: "Write a comprehensive executive summary of this document", icon: FileText },
  { label: "Write Conclusion", instruction: "Write a detailed conclusion section based on the content of this document", icon: FileText },
];

export function AIInstructionInput({ onSubmit, isLoading, disabled }: AIInstructionInputProps) {
  const [instruction, setInstruction] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "generate">("edit");

  const handleSubmit = () => {
    if (!instruction.trim() || isLoading || disabled) return;
    onSubmit(instruction.trim());
    setInstruction("");
  };

  const handleQuickAction = (actionInstruction: string) => {
    if (isLoading || disabled) return;
    onSubmit(actionInstruction);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentActions = activeTab === "edit" ? editActions : generateActions;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Tab Toggle */}
        <div className="flex gap-2 mb-2">
          <Button
            variant={activeTab === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("edit")}
            className="flex-1"
          >
            <PenLine className="h-3 w-3 mr-1" />
            Edit
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">1 cr</Badge>
          </Button>
          <Button
            variant={activeTab === "generate" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("generate")}
            className="flex-1"
          >
            <FileText className="h-3 w-3 mr-1" />
            Generate
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">3 cr</Badge>
          </Button>
        </div>

        {/* Horizontally scrollable quick actions on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide sm:flex-wrap sm:overflow-x-visible sm:pb-0 sm:mx-0 sm:px-0">
          {currentActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.instruction)}
              disabled={isLoading || disabled}
              className="text-xs whitespace-nowrap shrink-0 sm:shrink"
            >
              <action.icon className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Stack on mobile, side by side on larger screens */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeTab === "edit" 
              ? "Tell the AI what to improve... (Ctrl+Enter to send)" 
              : "Describe what content to generate... (Ctrl+Enter to send)"}
            className="min-h-[80px] sm:min-h-[60px] resize-none flex-1"
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
        
        {disabled && (
          <p className="text-xs text-destructive">
            No credits available. Please upgrade your plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
