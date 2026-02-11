import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Section, Question, createEmptyQuestion } from "./types";
import { QuestionCard } from "./QuestionCard";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface Props {
  section: Section;
  sectionIndex: number;
  globalStartIndex: number;
  onChange: (s: Section) => void;
  onDelete: () => void;
  errors: Record<string, string>;
}

export const SectionCard = ({ section, sectionIndex, globalStartIndex, onChange, onDelete, errors }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sKey = `s_${section.id}`;

  const updateQuestion = (qIndex: number, q: Question) => {
    const newQuestions = [...section.questions];
    newQuestions[qIndex] = q;
    onChange({ ...section, questions: newQuestions });
  };

  const addQuestion = () => {
    onChange({ ...section, questions: [...section.questions, createEmptyQuestion()] });
  };

  const duplicateQuestion = (qIndex: number) => {
    const q = section.questions[qIndex];
    const dup = { ...q, id: crypto.randomUUID() };
    const newQuestions = [...section.questions];
    newQuestions.splice(qIndex + 1, 0, dup);
    onChange({ ...section, questions: newQuestions });
  };

  const deleteQuestion = (qIndex: number) => {
    if (section.questions.length <= 1) return;
    onChange({ ...section, questions: section.questions.filter((_, i) => i !== qIndex) });
  };

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.questions.findIndex((q) => q.id === active.id);
    const newIndex = section.questions.findIndex((q) => q.id === over.id);
    onChange({ ...section, questions: arrayMove(section.questions, oldIndex, newIndex) });
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <button {...attributes} {...listeners} className="mt-2 cursor-grab text-muted-foreground hover:text-foreground">
              <GripVertical className="h-5 w-5" />
            </button>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-muted-foreground">Section {sectionIndex + 1}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={onDelete} title="Delete section">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Section title *"
                value={section.title}
                onChange={(e) => onChange({ ...section, title: e.target.value })}
                className={`font-semibold ${errors[`${sKey}_title`] ? "border-destructive" : ""}`}
              />
              {errors[`${sKey}_title`] && <p className="text-xs text-destructive">{errors[`${sKey}_title`]}</p>}
              <Textarea
                placeholder="Section description (optional)"
                value={section.description || ""}
                onChange={(e) => onChange({ ...section, description: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
            <SortableContext items={section.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {section.questions.map((q, qi) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  globalIndex={globalStartIndex + qi}
                  onChange={(updated) => updateQuestion(qi, updated)}
                  onDuplicate={() => duplicateQuestion(qi)}
                  onDelete={() => deleteQuestion(qi)}
                  errors={errors}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" /> Add Question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
