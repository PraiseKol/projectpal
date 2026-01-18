import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, Wand2 } from "lucide-react";

interface AIInstructionInputProps {
  onSubmit: (instruction: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const quickActions = [
  { label: "Fix Grammar", instruction: "Fix all grammar and spelling errors in this document" },
  { label: "Improve Clarity", instruction: "Improve the clarity and readability of this document" },
  { label: "Academic Tone", instruction: "Make this document more formal and academic in tone" },
  { label: "Simplify", instruction: "Simplify complex sentences and make the text easier to understand" },
];

export function AIInstructionInput({ onSubmit, isLoading, disabled }: AIInstructionInputProps) {
  const [instruction, setInstruction] = useState("");

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

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.instruction)}
              disabled={isLoading || disabled}
              className="text-xs"
            >
              <Wand2 className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the AI what to do with your document... (Ctrl+Enter to send)"
            className="min-h-[60px] resize-none"
            disabled={isLoading || disabled}
          />
          <Button
            onClick={handleSubmit}
            disabled={!instruction.trim() || isLoading || disabled}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
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
