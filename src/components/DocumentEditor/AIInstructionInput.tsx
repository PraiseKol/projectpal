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
        {/* Horizontally scrollable quick actions on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide sm:flex-wrap sm:overflow-x-visible sm:pb-0 sm:mx-0 sm:px-0">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.instruction)}
              disabled={isLoading || disabled}
              className="text-xs whitespace-nowrap shrink-0 sm:shrink"
            >
              <Wand2 className="h-3 w-3 mr-1" />
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
            placeholder="Tell the AI what to do... (Ctrl+Enter to send)"
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