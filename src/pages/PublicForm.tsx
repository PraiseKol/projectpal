import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getScaleLabels, type QuestionnaireData } from "@/components/Questionnaire/types";

interface PublicFormData {
  title: string;
  schema: QuestionnaireData;
  require_all: boolean;
  thank_you_message: string | null;
  status: "open" | "closed" | "full";
}

type Answers = Record<string, string | number>;

const tokenKey = (slug: string) => `pp_form_token_${slug}`;
const doneKey = (slug: string) => `pp_form_done_${slug}`;

const getToken = (slug: string): string => {
  try {
    let t = localStorage.getItem(tokenKey(slug));
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(tokenKey(slug), t);
    }
    return t;
  } catch {
    return crypto.randomUUID();
  }
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-muted/30 py-6 sm:py-10 px-3 sm:px-4">
    <div className="max-w-2xl mx-auto space-y-4">
      {children}
      <p className="text-center text-xs text-muted-foreground pt-2">
        Created with{" "}
        <Link to="/" className="underline underline-offset-2">
          ProjectPal
        </Link>
        . Never submit passwords or other sensitive details through a form.
      </p>
    </div>
  </div>
);

const PublicForm = () => {
  const { slug = "" } = useParams();
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);

  // Do not let search engines index shared forms
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await (supabase as any).rpc("get_shared_form", { p_slug: slug });
        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setState("missing");
          return;
        }
        setForm(data as PublicFormData);
        document.title = (data as PublicFormData).title || "Questionnaire";
        try {
          if (localStorage.getItem(doneKey(slug))) setDone(true);
        } catch {
          /* storage not available */
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const questionIds = useMemo(
    () => (form?.schema?.sections ?? []).flatMap((s) => (s.questions ?? []).map((q) => q.id)),
    [form]
  );

  const setAnswer = (id: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setMissing((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitError("");

    // A real person never sees or fills this hidden box
    if (honeypot.current?.value) {
      setDone(true);
      return;
    }

    if (form.require_all) {
      const notAnswered = questionIds.filter((id) => {
        const v = answers[id];
        return v === undefined || v === null || String(v).trim() === "";
      });
      if (notAnswered.length > 0) {
        setMissing(new Set(notAnswered));
        document.getElementById(`q-${notAnswered[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        setSubmitError("Please answer all the questions marked as required.");
        return;
      }
    }

    const cleaned: Answers = {};
    for (const id of questionIds) {
      const v = answers[id];
      if (v !== undefined && v !== null && String(v).trim() !== "") cleaned[id] = typeof v === "string" ? v.trim() : v;
    }
    if (Object.keys(cleaned).length === 0) {
      setSubmitError("Please answer at least one question before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("submit_form_response", {
        p_slug: slug,
        p_answers: cleaned,
        p_client_token: getToken(slug),
      });
      if (error) throw error;
      if (data?.ok) {
        try {
          localStorage.setItem(doneKey(slug), "1");
        } catch {
          /* storage not available */
        }
        setDoneMessage(data.message || "");
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data?.duplicate) {
        try {
          localStorage.setItem(doneKey(slug), "1");
        } catch {
          /* storage not available */
        }
        setDone(true);
      } else {
        setSubmitError(data?.error || "Your response could not be saved. Please try again.");
      }
    } catch {
      setSubmitError("Something went wrong while sending your response. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (state === "missing" || state === "error" || !form) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold">{state === "error" ? "This form could not be loaded" : "Form not found"}</h1>
            <p className="text-sm text-muted-foreground">
              {state === "error"
                ? "Please check your internet connection and refresh the page."
                : "The link may be wrong, or the owner may have removed this form."}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <h1 className="text-xl font-semibold">{form.title}</h1>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {doneMessage || form.thank_you_message || "Your response has been recorded. Thank you!"}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (form.status !== "open") {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">{form.title}</h1>
            <p className="text-sm text-muted-foreground">
              {form.status === "full"
                ? "This form has reached its response limit and is no longer accepting responses."
                : "This form is no longer accepting responses."}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const schema = form.schema;
  let counter = 0;

  return (
    <Shell>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="py-6 space-y-3">
            <h1 className="text-2xl font-bold">{schema.title || form.title}</h1>
            {schema.subtitle && <p className="text-muted-foreground">{schema.subtitle}</p>}
            {(schema.labels ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {schema.labels!.map((l) => (
                  <Badge key={l} variant="secondary" className="text-xs">
                    {l}
                  </Badge>
                ))}
              </div>
            )}
            {schema.introText && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{schema.introText}</p>}
            {form.require_all && <p className="text-xs text-red-600">* All questions are required</p>}
          </CardContent>
        </Card>

        {schema.sections.map((section, si) => (
          <div key={section.id} className="space-y-4">
            {(section.title || section.description) && (
              <Card>
                <CardContent className="py-4">
                  <h2 className="text-lg font-semibold">{section.title || `Section ${si + 1}`}</h2>
                  {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
                </CardContent>
              </Card>
            )}

            {section.questions.map((q) => {
              counter += 1;
              const value = answers[q.id];
              const isMissing = missing.has(q.id);
              return (
                <Card key={q.id} id={`q-${q.id}`} className={cn(isMissing && "border-red-500")}>
                  <CardContent className="py-5 space-y-3">
                    <p className="font-medium">
                      <span className="text-primary font-bold mr-1">{counter}.</span>
                      {q.text}
                      {form.require_all && <span className="text-red-600 ml-1">*</span>}
                    </p>
                    {q.helperText && <p className="text-xs text-muted-foreground italic">{q.helperText}</p>}

                    {q.type === "short_text" && (
                      <Input
                        value={typeof value === "string" ? value : ""}
                        maxLength={500}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="Your answer"
                      />
                    )}

                    {q.type === "long_text" && (
                      <Textarea
                        rows={4}
                        value={typeof value === "string" ? value : ""}
                        maxLength={5000}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="Your answer"
                      />
                    )}

                    {(q.type === "yes_no" || q.type === "multiple_choice") && (
                      <div className="space-y-2">
                        {(q.type === "yes_no" ? ["Yes", "No"] : q.options ?? []).map((opt) => (
                          <label
                            key={opt}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors",
                              value === opt ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            )}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                              checked={value === opt}
                              onChange={() => setAnswer(q.id, opt)}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === "rating_scale" && (
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {getScaleLabels(q.scaleDirection || "1to5").map((item) => (
                          <label
                            key={item.value}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-lg border px-1 py-3 cursor-pointer text-center transition-colors",
                              value === item.value ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                            )}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="sr-only"
                              checked={value === item.value}
                              onChange={() => setAnswer(q.id, item.value)}
                            />
                            <span className="text-lg font-semibold">{item.value}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {isMissing && <p className="text-xs text-red-600">This question is required.</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}

        {/* Hidden trap for automatic form-filling bots */}
        <input
          ref={honeypot}
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setAnswers({});
              setMissing(new Set());
              setSubmitError("");
            }}
          >
            Clear form
          </button>
        </div>
      </form>
    </Shell>
  );
};

export default PublicForm;
