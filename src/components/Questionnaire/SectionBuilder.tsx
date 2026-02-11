import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Section, createEmptySection } from "./types";
import { SectionCard } from "./SectionCard";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface Props {
  sections: Section[];
  onChange: (sections: Section[]) => void;
  errors: Record<string, string>;
}

export const SectionBuilder = ({ sections, onChange, errors }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addSection = () => {
    onChange([...sections, createEmptySection()]);
  };

  const updateSection = (index: number, section: Section) => {
    const newSections = [...sections];
    newSections[index] = section;
    onChange(newSections);
  };

  const deleteSection = (index: number) => {
    if (sections.length <= 1) return;
    onChange(sections.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    onChange(arrayMove(sections, oldIndex, newIndex));
  };

  // Calculate global question index offsets
  const getGlobalStartIndex = (sectionIndex: number) => {
    let count = 1;
    for (let i = 0; i < sectionIndex; i++) {
      count += sections[i].questions.length;
    }
    return count;
  };

  return (
    <div className="space-y-4">
      {errors.sections && <p className="text-sm text-destructive">{errors.sections}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              sectionIndex={i}
              globalStartIndex={getGlobalStartIndex(i)}
              onChange={(s) => updateSection(i, s)}
              onDelete={() => deleteSection(i)}
              errors={errors}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button variant="outline" className="w-full gap-2" onClick={addSection}>
        <Plus className="h-4 w-4" /> Add Section
      </Button>
    </div>
  );
};
