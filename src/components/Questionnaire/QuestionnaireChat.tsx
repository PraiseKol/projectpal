import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, Loader2, Hammer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { QuestionnaireData } from "./types";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

interface QuestionnaireChatProps {
  currentQuestionnaire: QuestionnaireData;
  onQuestionnaireGenerated: (data: QuestionnaireData) => void;
}

const SUGGESTION_CHIPS = [
  "I need a customer satisfaction survey",
  "Help me design a student feedback questionnaire",
  "I want to create a research demographics section",
];

export const QuestionnaireChat = ({ currentQuestionnaire, onQuestionnaireGenerated }: QuestionnaireChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readyToBuild = messages.length >= 4; // At least 2 exchanges (user+ai each)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string, mode: "chat" | "build" = "chat") => {
    if (!text.trim() || isLoading || isBuilding) return;

    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    if (mode === "build") {
      setIsBuilding(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use the AI assistant");
        setIsLoading(false);
        setIsBuilding(false);
        return;
      }

      const history = [...messages, userMessage].map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/questionnaire-ai`,
        {
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
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) {
          toast.error(err.error || "Insufficient credits");
        } else if (response.status === 429) {
          toast.error("Rate limited. Please wait a moment.");
        } else {
          toast.error(err.error || "Failed to get AI response");
        }
        return;
      }

      const data = await response.json();

      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);

      if (data.questionnaire) {
        onQuestionnaireGenerated(data.questionnaire);
        toast.success("Questionnaire generated! Check the Builder tab.", { duration: 3000 });
      }
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
    sendMessage("Generate my questionnaire based on our discussion.", "build");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages area */}
      <ScrollArea className="flex-1 pr-2" ref={scrollRef as any}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Questionnaire Assistant</h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-md">
                  Chat with the AI to plan your questionnaire (2 credits/message).
                  When you're ready, click Build to generate it (5 credits).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {SUGGESTION_CHIPS.map((chip) => (
                  <Button
                    key={chip}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(chip)}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "ai" ? (
                  <MarkdownRenderer content={msg.content} className="text-sm" />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {(isLoading || isBuilding) && (
            <div className="flex gap-2.5 justify-start">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  {isBuilding && <span className="text-xs text-muted-foreground">Building questionnaire…</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Build button */}
      {readyToBuild && !isBuilding && (
        <div className="pt-2 pb-1">
          <Button
            onClick={handleBuild}
            disabled={isLoading || isBuilding}
            className="w-full gap-2"
            size="sm"
          >
            <Hammer className="h-4 w-4" />
            Build Questionnaire (5 credits)
          </Button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-border mt-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your questionnaire needs..."
          disabled={isLoading || isBuilding}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || isBuilding || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
