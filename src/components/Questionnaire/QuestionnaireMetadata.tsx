import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { QuestionnaireData } from "./types";
import { useState } from "react";

interface Props {
  data: QuestionnaireData;
  onChange: (data: QuestionnaireData) => void;
  errors: Record<string, string>;
}

export const QuestionnaireMetadata = ({ data, onChange, errors }: Props) => {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !(data.labels || []).includes(tag)) {
      onChange({ ...data, labels: [...(data.labels || []), tag] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange({ ...data, labels: (data.labels || []).filter((l) => l !== tag) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="q-title">Title *</Label>
        <Input
          id="q-title"
          placeholder="e.g., Customer Satisfaction Survey"
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          className={errors.title ? "border-destructive" : ""}
        />
        {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
      </div>

      <div>
        <Label htmlFor="q-subtitle">Subtitle</Label>
        <Input
          id="q-subtitle"
          placeholder="Optional subtitle"
          value={data.subtitle || ""}
          onChange={(e) => onChange({ ...data, subtitle: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="q-intro">Introduction Text</Label>
        <Textarea
          id="q-intro"
          placeholder="Optional introduction or instructions..."
          value={data.introText || ""}
          onChange={(e) => onChange({ ...data, introText: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label>Tags / Labels</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="Add a tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>
            Add
          </Button>
        </div>
        {(data.labels || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {data.labels!.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
