import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Hammer,
  ClipboardList,
  CheckCircle2,
  Eye,
  Share2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { QuestionnaireData } from "./types";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  /** "result" messages are the hand-off card shown after a questionnaire is built */
  kind?: "result";
  meta?: { title: string; sections: number; questions: number };
}

interface Brief {
  topic: string;
  respondents: string;
  objectives: string;
  variables: string;
  sections: string;
  types: string[];
  scale: "1to5" | "5to1";
  perSection: string;
  mustHave: string;
  tone: string;
}

type TargetTab = "builder" | "preview" | "share";

interface QuestionnaireChatProps {
  currentQuestionnaire: QuestionnaireData;
  onQuestionnaireGenerated: (data: QuestionnaireData) => void;
  /** Lets the chat take the user to another tab with the questionnaire already loaded */
  onOpenTab?: (tab: TargetTab) => void;
}

const EMPTY_BRIEF: Brief = {
  topic: "",
  respondents: "",
  objectives: "",
  variables: "",
  sections: "",
  types: ["multiple_choice", "rating_scale"],
  scale: "1to5",
  perSection: "8-10",
  mustHave: "",
  tone: "",
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "rating_scale", label: "Rating scale (1 to 5)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "short_text", label: "Short written answer" },
  { value: "long_text", label: "Long written answer" },
];

const NEW_CHIPS = [
  "A student survey on social media use and academic performance",
  "A customer satisfaction survey for a small business",
  "A staff job satisfaction questionnaire for a hospital",
];

const REFINE_CHIPS = [
  "Add a demographics section",
  "Add 5 more open-ended questions",
  "Make every rating question run from 5 to 1",
  "Shorten each section to 6 questions",
];

const CHECKLIST = [
  ["Topic and purpose", "What the study or survey is about"],
  ["Respondents", "Who will answer, e.g. 300-level students of a university"],
  ["Objectives or hypotheses", "What you want to find out"],
  ["Variables to measure", "e.g. social media use, academic performance"],
  ["Sections you want", "e.g. demographics, one section per variable"],
  ["Question styles", "Multiple choice, ratings, yes/no, written answers"],
  ["Length", "Questions per section, and any must-have questions"],
  ["Intro and tone", "Consent text, language level"],
];

const briefToMessage = (b: Brief): string => {
  const typeLabels = TYPE_OPTIONS.filter((t) => b.types.includes(t.value)).map((t) => t.label);
  const lines = [
    "Here is my questionnaire brief.",
    b.topic.trim() && `Topic and purpose: ${b.topic.trim()}`,
    b.respondents.trim() && `Respondents: ${b.respondents.trim()}`,
    b.objectives.trim() && `Objectives, research questions or hypotheses: ${b.objectives.trim()}`,
    b.variables.trim() && `Variables to measure: ${b.variables.trim()}`,
    b.sections.trim() && `Sections wanted: ${b.sections.trim()}`,
    typeLabels.length > 0 && `Question types to use: ${typeLabels.join(", ")}`,
    b.types.includes("rating_scale") &&
      `Rating scale: ${b.scale === "1to5" ? "1 is the lowest and 5 is the highest" : "5 is the lowest and 1 is the highest"}`,
    b.perSection && `Questions per section: about ${b.perSection}`,
    b.mustHave.trim() && `Must include: ${b.mustHave.trim()}`,
    b.tone.trim() && `Introduction and tone: ${b.tone.trim()}`,
  ];
  return lines.filter(Boolean).join("\n");
};

export const QuestionnaireChat = ({ currentQuestionnaire, onQuestionnaireGenerated, onOpenTab }: QuestionnaireChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [showBrief, setShowBrief] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const questionCount = useMemo(
    () => currentQuestionnaire.sections.reduce((n, s) => n + s.questions.length, 0),
    [currentQuestionnaire]
  );
  const hasQuestions = questionCount > 0;
  const hasConversation = messages.some((m) => m.role === "user") && messages.some((m) => m.role === "ai" && m.kind !== "result");
  const readyToBuild = hasConversation;
  const busy = isLoading || isBuilding;

  // The conversation and the brief are saved, so they survive tab switches and page reloads
  const storageKey = userId ? `pp_qchat_${userId}` : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? "guest"));
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
        if (saved.brief) setBrief({ ...EMPTY_BRIEF, ...saved.brief });
      }
    } catch {
      /* ignore a damaged save */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages: messages.slice(-80), brief }));
    } catch {
      /* storage full or not available */
    }
  }, [messages, brief, storageKey, hydrated]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, isBuilding]);

  const sendMessage = async (text: string, mode: "chat" | "build" = "chat") => {
    if (!text.trim() || busy) return;

    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    const priorMessages = messages;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowBrief(false);

    if (mode === "build") setIsBuilding(true);
    else setIsLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use the AI assistant");
        return;
      }

      // The hand-off cards are only for the screen, so they are not sent to the AI
      const history = [...priorMessages, userMessage]
        .filter((m) => m.kind !== "result")
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/questionnaire-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history,
          currentQuestionnaire,
          mode,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) toast.error(err.error || "Insufficient credits");
        else if (response.status === 429) toast.error("Rate limited. Please wait a moment.");
        else toast.error(err.error || "Failed to get AI response");
        return;
      }

      const data = await response.json();
      const added: ChatMessage[] = [{ role: "ai", content: data.reply }];

      if (data.questionnaire) {
        const q = data.questionnaire as QuestionnaireData;
        added.push({
          role: "ai",
          kind: "result",
          content: "",
          meta: {
            title: q.title,
            sections: q.sections.length,
            questions: q.sections.reduce((n, s) => n + s.questions.length, 0),
          },
        });
        onQuestionnaireGenerated(q);
      }
      setMessages((prev) => [...prev, ...added]);
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setIsBuilding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleBuild = () => {
    sendMessage(
      hasQuestions
        ? "Update my questionnaire based on our discussion. Keep what I have unless I asked you to change it."
        : "Generate my questionnaire based on our discussion.",
      "build"
    );
  };

  const briefHasEnough = brief.topic.trim().length > 2 && (brief.objectives.trim().length > 2 || brief.variables.trim().length > 2);

  const buildFromBrief = () => {
    if (!briefHasEnough) {
      toast.error("Add at least the topic, and what you want to find out or measure.");
      return;
    }
    sendMessage(briefToMessage(brief), "build");
  };

  const reviewBrief = () => {
    if (!brief.topic.trim()) {
      toast.error("Add at least the topic first.");
      return;
    }
    sendMessage(briefToMessage(brief), "chat");
  };

  const newConversation = () => {
    if (messages.length > 0 && !window.confirm("Start a new conversation? The current chat will be cleared. Your questionnaire stays as it is.")) return;
    setMessages([]);
  };

  const toggleType = (value: string) =>
    setBrief((b) => ({ ...b, types: b.types.includes(value) ? b.types.filter((t) => t !== value) : [...b.types, value] }));

  const briefForm = (
    <Card className="border-primary/30">
      <CardContent className="pt-5 space-y-4">
        <div>
          <h4 className="font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Guided brief
          </h4>
          <p className="text-xs text-muted-foreground">
            Fill in what you know. Anything you leave empty, the AI will ask about or decide sensibly.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="b-topic">Topic and purpose *</Label>
          <Input id="b-topic" value={brief.topic} onChange={(e) => setBrief({ ...brief, topic: e.target.value })} placeholder="e.g. Effect of social media use on students' academic performance" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-resp">Who will answer?</Label>
          <Input id="b-resp" value={brief.respondents} onChange={(e) => setBrief({ ...brief, respondents: e.target.value })} placeholder="e.g. 300-level undergraduates at a Nigerian university" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-obj">Objectives, research questions or hypotheses</Label>
          <Textarea id="b-obj" rows={3} value={brief.objectives} onChange={(e) => setBrief({ ...brief, objectives: e.target.value })} placeholder={"1. Find out how much time students spend on social media\n2. Examine the relationship with their CGPA"} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-var">Variables or concepts to measure</Label>
          <Textarea id="b-var" rows={2} value={brief.variables} onChange={(e) => setBrief({ ...brief, variables: e.target.value })} placeholder="e.g. social media usage, study habits, academic performance" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-sec">Sections you want (optional)</Label>
          <Input id="b-sec" value={brief.sections} onChange={(e) => setBrief({ ...brief, sections: e.target.value })} placeholder="e.g. Demographics, Social media use, Academic performance, Comments" />
        </div>

        <div className="space-y-2">
          <Label>Question styles to use</Label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.value}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  brief.types.includes(t.value) ? "border-primary bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={brief.types.includes(t.value)} onChange={() => toggleType(t.value)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-scale">Rating scale direction</Label>
            <select id="b-scale" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={brief.scale} onChange={(e) => setBrief({ ...brief, scale: e.target.value as Brief["scale"] })}>
              <option value="1to5">1 is lowest, 5 is highest</option>
              <option value="5to1">5 is lowest, 1 is highest</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-per">Questions per section</Label>
            <select id="b-per" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={brief.perSection} onChange={(e) => setBrief({ ...brief, perSection: e.target.value })}>
              <option value="5-8">About 5 to 8</option>
              <option value="8-10">About 8 to 10</option>
              <option value="10-15">About 10 to 15</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="b-must">Questions that must be included (optional)</Label>
          <Textarea id="b-must" rows={2} value={brief.mustHave} onChange={(e) => setBrief({ ...brief, mustHave: e.target.value })} placeholder="e.g. Which social media platform do you use most?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-tone">Introduction text and tone (optional)</Label>
          <Input id="b-tone" value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })} placeholder="e.g. Include a consent note. Simple language for undergraduates." />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button onClick={buildFromBrief} disabled={busy} className="gap-2">
            <Hammer className="h-4 w-4" /> Build now (5 credits)
          </Button>
          <Button variant="outline" onClick={reviewBrief} disabled={busy} className="gap-2">
            <Send className="h-4 w-4" /> Let the AI review it first (2 credits)
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={() => setShowBrief(false)}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[420px]">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 pb-2 text-xs text-muted-foreground">
        <span>
          {hasQuestions
            ? `The AI can see your current questionnaire (${questionCount} questions). Ask it to change or extend it.`
            : "Tell the AI about your study and it will guide you to a complete questionnaire."}
        </span>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={newConversation} disabled={busy}>
            <RotateCcw className="h-3 w-3" /> New chat
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {hasQuestions ? "Refine your questionnaire with AI" : "Let's build your questionnaire"}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        {hasQuestions
                          ? "Your current questionnaire is loaded. Tell me what to change, add or remove."
                          : "To build a questionnaire that fits your study, I need a few details. Send as much as you can in one message, or use the guided brief. I will ask only for what is missing."}
                      </p>
                    </div>
                  </div>

                  {!hasQuestions && (
                    <>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {CHECKLIST.map(([title, hint], i) => (
                          <div key={title} className="flex gap-2">
                            <span className="text-primary font-semibold">{i + 1}.</span>
                            <span>
                              <strong>{title}</strong>
                              <span className="text-muted-foreground"> - {hint}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Chatting costs 2 credits per message and building costs 5 credits. The guided brief below is free to fill in.
                      </p>
                    </>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!hasQuestions && (
                      <Button size="sm" onClick={() => setShowBrief((s) => !s)} className="gap-1.5">
                        <ClipboardList className="h-4 w-4" /> {showBrief ? "Hide guided brief" : "Open guided brief"}
                        {showBrief ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {(hasQuestions ? REFINE_CHIPS : NEW_CHIPS).map((chip) => (
                      <Button key={chip} variant="outline" size="sm" className="text-xs h-auto py-1.5 whitespace-normal text-left" onClick={() => sendMessage(chip)} disabled={busy}>
                        {chip}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {showBrief && briefForm}
            </div>
          )}

          {messages.map((msg, i) =>
            msg.kind === "result" && msg.meta ? (
              <Card key={i} className="border-green-500/40 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Your questionnaire is ready and loaded</p>
                      <p className="text-sm text-muted-foreground">
                        {msg.meta.title}: {msg.meta.questions} questions in {msg.meta.sections} sections. Edit it in the Builder, check it in Preview, or
                        share it as a link. You can keep chatting to refine it, because I always see the latest version.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onOpenTab?.("builder")} className="gap-1.5">
                      <Hammer className="h-4 w-4" /> Open in Builder
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onOpenTab?.("preview")} className="gap-1.5">
                      <Eye className="h-4 w-4" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onOpenTab?.("share")} className="gap-1.5">
                      <Share2 className="h-4 w-4" /> Share as link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.role === "ai" ? <MarkdownRenderer content={msg.content} className="text-sm" /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          )}

          {messages.length > 0 && showBrief && briefForm}

          {busy && (
            <div className="flex gap-2.5 justify-start">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {isBuilding ? "Building your questionnaire. This can take up to a minute..." : "Thinking..."}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Build button */}
      {readyToBuild && !isBuilding && (
        <div className="pt-2 pb-1 flex gap-2">
          <Button onClick={handleBuild} disabled={busy} className="flex-1 gap-2" size="sm">
            <Hammer className="h-4 w-4" />
            {hasQuestions ? "Update my questionnaire (5 credits)" : "Build questionnaire (5 credits)"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBrief((s) => !s)} disabled={busy} className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Guided brief
          </Button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-border mt-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasQuestions ? "Tell the AI what to change or add..." : "Describe your study, or answer the AI's questions..."}
          disabled={busy}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
