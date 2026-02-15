import { Badge } from "@/components/ui/badge";
import { QuestionnaireData, getScaleLabels } from "./types";

interface Props {
  data: QuestionnaireData;
}

export const QuestionnairePreview = ({ data }: Props) => {
  let globalQ = 0;

  return (
    <div className="bg-background border border-border rounded-xl p-6 md:p-10 max-w-[800px] mx-auto shadow-sm print:shadow-none print:border-none space-y-6" id="questionnaire-preview">
      {/* Header */}
      <div className="text-center space-y-2 border-b border-border pb-6">
        <h1 className="text-2xl font-bold">{data.title || "Untitled Questionnaire"}</h1>
        {data.subtitle && <p className="text-muted-foreground">{data.subtitle}</p>}
        {(data.labels || []).length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {data.labels!.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
            ))}
          </div>
        )}
      </div>

      {data.introText && (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap border-b border-border pb-4">
          {data.introText}
        </div>
      )}

      {/* Sections */}
      {data.sections.map((section, si) => (
        <div key={section.id} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {section.title || `Section ${si + 1}`}
            </h2>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
            )}
          </div>

          {section.questions.map((q) => {
            globalQ++;
            return (
              <div key={q.id} className="pl-2 space-y-2">
                <p className="font-medium text-sm">
                  <span className="text-primary font-bold mr-1">{globalQ}.</span>
                  {q.text || "(No question text)"}
                </p>
                {q.helperText && (
                  <p className="text-xs text-muted-foreground italic ml-5">{q.helperText}</p>
                )}

                <div className="ml-5 mt-1">
                  {q.type === "yes_no" && (
                    <div className="flex gap-6 text-sm">
                      <label className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-muted-foreground inline-block" />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-muted-foreground inline-block" />
                        No
                      </label>
                    </div>
                  )}

                  {q.type === "short_text" && (
                    <div className="border-b-2 border-muted-foreground/30 h-8 max-w-md" />
                  )}

                  {q.type === "long_text" && (
                    <div className="border-2 border-muted-foreground/20 rounded-md h-20 max-w-lg" />
                  )}

                  {q.type === "rating_scale" && (
                    <div className="overflow-x-auto">
...
                    </div>
                  )}

                  {q.type === "multiple_choice" && (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-4 h-4 rounded-full border-2 border-muted-foreground inline-block shrink-0" />
                          {opt || `Option ${i + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
