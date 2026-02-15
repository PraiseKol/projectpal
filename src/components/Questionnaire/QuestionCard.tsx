import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GripVertical, Copy, Trash2, Plus } from "lucide-react";
import { Question, QuestionType, ScaleDirection } from "./types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  question: Question;
  globalIndex: number;
  onChange: (q: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  errors: Record<string, string>;
}

export const QuestionCard = ({ question, globalIndex, onChange, onDuplicate, onDelete, errors }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const qKey = `q_${question.id}`;

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-xl p-4 bg-background space-y-3">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-primary mt-1.5 min-w-[2rem]">Q{globalIndex}</span>
        <div className="flex-1 space-y-3">
          <div>
            <Input
              placeholder="Enter question text..."
              value={question.text}
              onChange={(e) => onChange({ ...question, text: e.target.value })}
              className={errors[`${qKey}_text`] ? "border-destructive" : ""}
            />
            {errors[`${qKey}_text`] && <p className="text-xs text-destructive mt-1">{errors[`${qKey}_text`]}</p>}
          </div>
          <Input
            placeholder="Helper text (optional)"
            value={question.helperText || ""}
            onChange={(e) => onChange({ ...question, helperText: e.target.value })}
            className="text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[160px]">
              <Label className="text-xs">Response Type</Label>
              <Select
                value={question.type}
                onValueChange={(v) => {
                const update: Partial<Question> = { type: v as QuestionType };
                  if (v === 'rating_scale' && !question.scaleDirection) {
                    update.scaleDirection = '1to5';
                  }
                  if (v === 'multiple_choice' && (!question.options || question.options.length < 2)) {
                    update.options = ['', ''];
                  }
                  onChange({ ...question, ...update });
                }}
              >
                <SelectTrigger className={errors[`${qKey}_type`] ? "border-destructive" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="short_text">Short Text</SelectItem>
                  <SelectItem value="long_text">Long Text</SelectItem>
                  <SelectItem value="rating_scale">Rating Scale</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {question.type === 'rating_scale' && (
              <div className="min-w-[140px]">
                <Label className="text-xs">Scale Direction</Label>
                <RadioGroup
                  value={question.scaleDirection || '1to5'}
                  onValueChange={(v) => onChange({ ...question, scaleDirection: v as ScaleDirection })}
                  className="flex gap-3 mt-1"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="1to5" id={`${question.id}-1to5`} />
                    <Label htmlFor={`${question.id}-1to5`} className="text-xs cursor-pointer">1→5</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="5to1" id={`${question.id}-5to1`} />
                    <Label htmlFor={`${question.id}-5to1`} className="text-xs cursor-pointer">5→1</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            {question.type === 'multiple_choice' && (
              <div className="space-y-2 w-full">
                <Label className="text-xs">Options</Label>
                {(question.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[1.5rem]">{i + 1}.</span>
                    <Input
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...(question.options || [])];
                        newOptions[i] = e.target.value;
                        onChange({ ...question, options: newOptions });
                      }}
                      className="text-sm"
                    />
                    {(question.options || []).length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => {
                          const newOptions = (question.options || []).filter((_, idx) => idx !== i);
                          onChange({ ...question, options: newOptions });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => onChange({ ...question, options: [...(question.options || []), ''] })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
