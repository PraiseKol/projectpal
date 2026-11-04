import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  MessageSquare,
  Plus,
  Menu,
  X,
  Trash2,
  Copy,
  Check,
  FastForward,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Coins,
  Shield,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { TypingEffect } from "@/components/TypingEffect";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { ShareWithClassmates } from "@/components/ShareWithClassmates";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportOptions } from "@/components/ExportOptions";
import { translateError, logError } from "@/utils/errorMessages";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

const CREDIT_OPERATIONS = [
  { key: "credit_cost_simple_chat", label: "Simple Chat", defaultCost: 1, category: "Basic" },
  { key: "credit_cost_article_search", label: "Article Search", defaultCost: 1, category: "Basic" },
  { key: "credit_cost_grammar_fix", label: "Fix Grammar", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_suggestions", label: "Suggestions", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_paraphraser", label: "Paraphraser", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_analysis", label: "Summarize / Key Points", defaultCost: 4, category: "Analysis" },
  { key: "credit_cost_chapter_1", label: "Chapter 1", defaultCost: 5, category: "Writing" },
  { key: "credit_cost_chapter_5", label: "Chapter 5", defaultCost: 5, category: "Writing" },
  { key: "credit_cost_questionnaire_chat", label: "Questionnaire Chat", defaultCost: 2, category: "Tools" },
  { key: "credit_cost_questionnaire_build", label: "Questionnaire Build", defaultCost: 5, category: "Tools" },
  { key: "credit_cost_questionnaire_export", label: "Questionnaire Export", defaultCost: 5, category: "Tools" },
  { key: "credit_cost_chapter_2", label: "Chapter 2", defaultCost: 10, category: "Writing" },
  { key: "credit_cost_ppt_base", label: "PowerPoint", defaultCost: 10, category: "Tools" },
  { key: "credit_cost_ppt_images", label: "PPT + Images", defaultCost: 15, category: "Tools" },
  { key: "credit_cost_humanizer", label: "AI Humanizer", defaultCost: 5, category: "Tools" },
  { key: "credit_cost_research_proposal", label: "Research Proposal", defaultCost: 20, category: "Writing" },
  { key: "credit_cost_journal_paper", label: "Journal Paper", defaultCost: 20, category: "Writing" },
  { key: "credit_cost_references", label: "References", defaultCost: 15, category: "Writing" },
  { key: "credit_cost_chapter_3", label: "Chapter 3", defaultCost: 25, category: "Writing" },
  { key: "credit_cost_data_analysis", label: "Data Analysis", defaultCost: 30, category: "Analysis" },
  { key: "credit_cost_chapter_4", label: "Chapter 4", defaultCost: 50, category: "Writing" },
  { key: "credit_cost_full_wrap", label: "Full Project Wrap", defaultCost: 50, category: "Writing" },
];

const Chat = () => {
  const navigate = useNavigate();
  const { showUpgrade } = useUpgradeModal();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});
  const [costsOpen, setCostsOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const loadSessionRef = useRef(0);
  // Mobile keyboards shrink the visible viewport — track it so the composer stays visible
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !isMobile) return;
    const onResize = () => setVvHeight(vv.height);
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [isMobile]);

  const displayedSessions = showAllChats ? chatSessions : chatSessions.slice(0, 3);

  // Generate a title from the first user message
  const generateTitle = (message: string): string => {
    const cleaned = message.trim().replace(/\s+/g, " ");
    if (cleaned.length <= 35) return cleaned;
    const truncated = cleaned.substring(0, 35);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > 15 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
  };

  useEffect(() => {
    initializeChat();
    // Fetch live credit costs
    const fetchCreditCosts = async () => {
      try {
        const { data, error } = await supabase.from("app_settings").select("key, value").like("key", "credit_cost_%");
        if (!error && data) {
          const map: Record<string, number> = {};
          data.forEach((s) => {
            const val = parseInt(s.value, 10);
            if (!isNaN(val)) map[s.key] = val;
          });
          setCreditCosts(map);
        }
      } catch (e) {
        // fall back to defaults
      }
    };
    fetchCreditCosts();
  }, []);

  useEffect(() => {
    // Show sidebar by default on desktop
    if (!isMobile) {
      setShowSidebar(true);
    }
  }, [isMobile]);

  useEffect(() => {
    // Dashboard "starter" deep links fill the composer with the prompt
    const starter = searchParams.get("starter");
    if (starter) {
      setInput(starter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollUp(el.scrollTop > 200);
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const initializeChat = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      // Get profile
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      setProfile(profileData);

      // Load chat sessions
      await loadChatSessions(user.id);

      // Check if there's a session_id in URL params
      const urlSessionId = searchParams.get("session_id");

      if (urlSessionId) {
        // Load existing session
        await loadSession(urlSessionId);
      } else {
        // Don't create a session yet - wait until user sends first message
        setSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      logError("Chat:initializeChat", error);
      toast.error(translateError(error));
    }
  };

  const loadChatSessions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setChatSessions(data || []);
    } catch (error) {
      logError("Chat:loadChatSessions", error);
    }
  };

  const loadSession = async (targetSessionId: string) => {
    const requestId = ++loadSessionRef.current;
    setIsLoadingSession(true);
    try {
      // Load messages for this session
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", targetSessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Ignore stale responses — only the newest selection wins
      if (requestId !== loadSessionRef.current) return;

      // Switch session and messages together, so the view never shows one
      // conversation while the composer is aimed at another
      setSessionId(targetSessionId);
      setMessages(data || []);

      // Close sidebar on mobile after selecting a chat
      if (isMobile) {
        setShowSidebar(false);
      }
    } catch (error) {
      logError("Chat:loadSession", error);
      if (requestId === loadSessionRef.current) toast.error(translateError(error));
    } finally {
      if (requestId === loadSessionRef.current) setIsLoadingSession(false);
    }
  };

  const createNewChat = async () => {
    // Don't create a session in the database - just clear state
    setSessionId(null);
    setMessages([]);
    navigate("/chat");

    // Close sidebar on mobile after creating new chat
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleDeleteSession = async () => {
    // Capture the ID immediately before any state changes
    const sessionToDelete = deleteSessionId;
    if (!sessionToDelete) return;

    setIsDeleting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Delete messages first (due to foreign key)
      const { error: messagesError } = await supabase.from("messages").delete().eq("session_id", sessionToDelete);

      if (messagesError) {
        logError("Chat:deleteMessages", messagesError);
      }

      // Then delete the session
      const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionToDelete);

      if (error) throw error;

      toast.success("Chat deleted");

      // Close dialog first
      setDeleteSessionId(null);

      // Reload chat sessions
      await loadChatSessions(user.id);

      // If we deleted the current session, clear it and go to base chat route
      if (sessionToDelete === sessionId) {
        setSessionId(null);
        setMessages([]);
        navigate("/chat");
      }
    } catch (error) {
      logError("Chat:deleteSession", error);
      toast.error(translateError(error));
      setDeleteSessionId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setEditingSessionId(null);
      return;
    }

    try {
      const { error } = await supabase.from("chat_sessions").update({ title: trimmedTitle }).eq("id", sessionId);

      if (error) throw error;

      setChatSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: trimmedTitle } : s)));
      toast.success("Chat renamed");
    } catch (error) {
      logError("Chat:renameSession", error);
      toast.error(translateError(error));
    } finally {
      setEditingSessionId(null);
    }
  };

  const handleCopyMessage = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSkipTyping = () => {
    setTypingMessageId(null);
  };

  const handleSend = async (overrideMessage?: string) => {
    const rawText = overrideMessage ?? input;
    if (!rawText.trim() || isLoading) return;

    let currentSessionId = sessionId;

    // Lazy session creation: create on first message
    if (!currentSessionId) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: session, error } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, title: "New Chat" })
          .select()
          .single();

        if (error) throw error;
        currentSessionId = session.id;
        setSessionId(currentSessionId);
        navigate(`/chat?session_id=${currentSessionId}`, { replace: true });
        await loadChatSessions(user.id);
      } catch (error) {
        logError("Chat:createSessionOnSend", error);
        toast.error(translateError(error));
        return;
      }
    }

    // Check credits based on user type
    const isFreeUser =
      profile?.plan_type === "free" ||
      (profile?.credits_expiry_date && new Date(profile.credits_expiry_date) < new Date());
    // Match the server rule: a free user can spend min(daily, monthly) credits
    const hasCredits = isFreeUser
      ? Math.min(profile?.monthly_credits ?? 0, profile?.daily_credits ?? 0) > 0
      : profile?.daily_credits > 0 || profile?.paid_credits > 0;

    if (!hasCredits) {
      showUpgrade({
        featureName: "You've run out of credits",
        featureDescription: "Your free credits are used up. Upgrade to a paid plan for a bigger monthly allowance, or buy credits — paid plans never lose access mid-project.",
        requiredPlan: "pro",
      });
      return;
    }

    const userMessage = rawText.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Add user message to UI
      const userMsg: Message = {
        id: crypto.randomUUID(),
        sender: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Save user message
      const { error: insertError } = await supabase.from("messages").insert({
        session_id: currentSessionId,
        sender: "user",
        content: userMessage,
      });
      if (insertError) throw insertError;

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke("chat-ai", {
        body: { message: userMessage, session_id: currentSessionId },
      });

      if (error) throw error;

      // Add AI response to UI
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setTypingMessageId(aiMsg.id);
      setMessages((prev) => [...prev, aiMsg]);

      // Auto-name the chat if this is the first message
      const isFirstMessage = messages.length === 0;
      if (isFirstMessage && currentSessionId) {
        // Use AI-generated title from response, fallback to local generation
        const title = data.generated_title || generateTitle(userMessage);
        await supabase.from("chat_sessions").update({ title }).eq("id", currentSessionId);

        // Update local state
        setChatSessions((prev) => prev.map((s) => (s.id === currentSessionId ? { ...s, title } : s)));
      }

      // Update profile credits
      setProfile((prev: any) => ({ ...prev, ...data.profile }));
      setFailedMessage(null);
    } catch (error: any) {
      logError("Chat:sendMessage", error);
      // Keep the prompt so the user can retry it with one tap
      setFailedMessage(userMessage);
      // Check for 402 (insufficient credits) from edge function
      const errorBody = error?.context?.body;
      const statusCode = error?.context?.status || error?.status;
      if (statusCode === 402 || errorBody?.credits_required) {
        // Map action_type to human-readable labels
        const ACTION_LABELS: Record<string, string> = {
          chapter_1: "Chapter 1 (Introduction)",
          chapter_2: "Chapter 2 (Literature Review)",
          chapter_3: "Chapter 3 (Methodology)",
          chapter_4: "Chapter 4 (Results & Discussion)",
          chapter_5: "Chapter 5 (Conclusion)",
          references: "References / Bibliography",
          project_outline: "Project Outline",
          proposal: "Research Proposal",
          article_search: "Article Search",
          data_analysis: "Data Analysis",
          questionnaire: "Questionnaire",
          ppt_generation: "PPT Generation",
          chapter_1_outline: "Chapter 1 Outline",
          chapter_2_outline: "Chapter 2 Outline",
          chapter_3_outline: "Chapter 3 Outline",
          chapter_4_outline: "Chapter 4 Outline",
          chapter_5_outline: "Chapter 5 Outline",
        };
        const actionType = errorBody?.action_type;
        const actionLabel = actionType ? ACTION_LABELS[actionType] || actionType.replace(/_/g, ' ') : "this operation";
        let msg: string;
        if (errorBody?.credits_required && errorBody?.credits_available !== undefined) {
          msg = `Generating ${actionLabel} requires ${errorBody.credits_required} credits, but you only have ${errorBody.credits_available}. Upgrade to a plan with more credits, or buy a top-up to continue.`;
        } else {
          msg = errorBody?.error || "You've run out of credits. Upgrade to a plan with more credits to continue!";
        }
        showUpgrade({
          featureName: `Not enough credits for ${actionLabel}`,
          featureDescription: msg,
          requiredPlan: "pro",
        });
      } else {
        toast.error(translateError(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Generate Project Topic", prompt: "Generate a project topic for my field of study", costKey: "credit_cost_simple_chat" },
    { label: "Write Chapter 1 (Introduction)", prompt: "Help me write Chapter 1: Introduction for my project", costKey: "credit_cost_chapter_1" },
    { label: "Search for Articles", prompt: "Search for academic articles about [your topic here]", costKey: "credit_cost_article_search" },
    { label: "Write Chapter 2 (Literature Review)", prompt: "Help me write Chapter 2: Literature Review", costKey: "credit_cost_chapter_2" },
    { label: "Write Proposal", prompt: "Help me write a research proposal", costKey: "credit_cost_research_proposal" },
    { label: "Write Chapter 3 (Methodology)", prompt: "Help me write Chapter 3: Methodology", costKey: "credit_cost_chapter_3" },
    { label: "Generate References", prompt: "Generate academic references in APA format", costKey: "credit_cost_references" },
    {
      label: "Edit Chapter 4 (Results/Discussion)",
      prompt: "Help me edit and improve Chapter 4: Results and Discussion",
      costKey: "credit_cost_chapter_4",
    },
    { label: "Analyze", prompt: "Analyze your generated chapters", costKey: "credit_cost_analysis" },
    { label: "Write Chapter 5 (Conclusion)", prompt: "Help me write Chapter 5: Conclusion and Recommendations", costKey: "credit_cost_chapter_5" },
  ];

  // Live credit cost for a quick action (falls back to the default cost)
  const getOpCost = (key?: string) =>
    key ? creditCosts[key] ?? CREDIT_OPERATIONS.find((o) => o.key === key)?.defaultCost ?? null : null;

  // Get display credits based on plan type
  const getCreditsDisplay = () => {
    if (profile?.plan_type === "free") {
      return (
        <>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {profile?.daily_credits || 0} daily
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {profile?.monthly_credits || 0} monthly
          </Badge>
        </>
      );
    }
    return (
      <>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {profile?.daily_credits || 0} daily
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {profile?.paid_credits || 0} paid
        </Badge>
      </>
    );
  };

  // Check if content looks like a document (chapters, proposals, etc.)
  const isDocumentContent = (content: string) => {
    const docPatterns = [
      /^#+ (chapter|introduction|conclusion|methodology|literature|abstract|proposal)/i,
      /^## \d+\./,
      /^### \d+\.\d+/,
      /references|bibliography/i,
    ];
    return docPatterns.some((pattern) => pattern.test(content)) || content.length > 500;
  };

  const sidebarContent = (
    <div className="h-full bg-background border-r border-border flex flex-col">

        <div className="p-4 border-b border-border flex items-center justify-between">
          <Button onClick={createNewChat} className="flex-1" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
          {isMobile && (
            <Button variant="ghost" size="icon" className="ml-2" onClick={() => setShowSidebar(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {displayedSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl",
                  session.id === sessionId ? "bg-secondary" : "hover:bg-accent/50",
                )}
              >
                {/* Left icons (always visible) */}
                <div className="flex items-center gap-1 pl-2">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSessionId(session.id);
                    }}
                    aria-label={`Delete chat: ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {editingSessionId === session.id ? (
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameSession(session.id, editingTitle)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSession(session.id, editingTitle);
                      if (e.key === "Escape") setEditingSessionId(null);
                    }}
                    autoFocus
                    className="flex-1 h-8 text-sm mx-1"
                  />
                ) : (
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start text-left h-auto py-2 px-2 rounded-xl"
                    onClick={() => {
                      navigate(`/chat?session_id=${session.id}`);
                      loadSession(session.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(session.id);
                      setEditingTitle(session.title);
                    }}
                  >
                    <span className="truncate text-sm">{session.title}</span>
                  </Button>
                )}
              </div>
            ))}

            {chatSessions.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground text-xs mt-1"
                onClick={() => setShowAllChats(!showAllChats)}
              >
                {showAllChats ? "Show Less" : `View All (${chatSessions.length})`}
              </Button>
            )}
          </div>

          {/* Action Costs Section */}
          <div className="px-2 pb-2">
            <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50">
                <span className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" />
                  Action Costs
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", costsOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0.5 mt-1 max-h-60 overflow-y-auto">
                  {CREDIT_OPERATIONS.map((op) => (
                    <div
                      key={op.key}
                      className="flex items-center justify-between gap-2 px-2 py-1 text-xs rounded-md hover:bg-accent/30"
                    >
                      <span className="text-muted-foreground truncate">{op.label}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-5 shrink-0 min-w-[28px] text-center"
                      >
                        {creditCosts[op.key] || op.defaultCost}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
    </div>
  );

  const mainChatContent = (
    <div
      className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden"
      style={isMobile && vvHeight ? { height: `${vvHeight}px` } : undefined}
    >
        {/* Header */}
        <header className="border-b border-border sticky top-0 z-30 bg-background">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile hamburger menu */}
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(true)} aria-label="Open chats">
                <Menu className="h-5 w-5" />
              </Button>
              <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm" aria-label="Back to dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold hidden sm:inline">ProjectPal Chat</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {getCreditsDisplay()}
            </div>
          </div>
        </header>

        {/* Chat Area - flex column with only messages scrolling */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Scrollable messages area */}
          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {isLoadingSession ? (
              <div className="text-center py-12 text-muted-foreground">Loading conversation…</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Welcome to ProjectPal</h2>
                <p className="text-muted-foreground mb-6">
                  Your AI assistant for academic projects. Try one of these quick actions:
                </p>
                <div className="grid md:grid-cols-2 gap-2 max-w-3xl mx-auto">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="justify-start text-left h-auto py-3 rounded-xl hover:bg-accent/50"
                      onClick={() => setInput(action.prompt)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{action.label}</span>
                          {getOpCost(action.costKey) !== null && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {getOpCost(action.costKey)} cr
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{action.prompt}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="animate-fade-in">
                  {msg.sender === "user" ? (
                    <Card className="p-4 rounded-2xl bg-card shadow-sm ml-4 md:ml-12">
                      <MarkdownRenderer content={msg.content} />
                    </Card>
                  ) : (
                    <Card className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 mr-4 md:mr-12">
                      {msg.id === typingMessageId ? (
                        <>
                          <TypingEffect text={msg.content} onComplete={() => setTypingMessageId(null)}>
                            {(displayedText, isComplete) => (
                              <>
                                <MarkdownRenderer content={displayedText} />
                                {!isComplete && (
                                  <div className="mt-3 flex justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleSkipTyping}
                                      className="h-7 text-xs"
                                    >
                                      <FastForward className="h-3 w-3 mr-1" />
                                      Skip
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </TypingEffect>
                        </>
                      ) : (
                        <>
                          <MarkdownRenderer content={msg.content} />
                          {/* Chapter Action Prompt */}
                          {isDocumentContent(msg.content) && (
                            <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg p-2">
                              <Shield className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-xs text-muted-foreground flex-1">
                                Make this content undetectable by AI checkers
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs shrink-0"
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                              >
                                {copiedMessageId === msg.id ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3 mr-1" />
                                )}
                                {copiedMessageId === msg.id ? "" : "Copy"}
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs shrink-0"
                                onClick={() => navigate("/humanizer")}
                              >
                                Humanize
                              </Button>
                            </div>
                          )}
                          <div className="mt-3 flex justify-end gap-1 items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyMessage(msg.content, msg.id)}
                              className="h-8 px-2"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            {isDocumentContent(msg.content) && (
                              <ShareWithClassmates context="chapter" compact />
                            )}
                            <ExportOptions
                              content={msg.content}
                              chatTitle={chatSessions.find((s) => s.id === sessionId)?.title}
                            />
                          </div>
                        </>
                      )}
                    </Card>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 mr-4 md:mr-12 border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              </Card>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to top button */}
          {showScrollUp && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-8 top-4 z-20 rounded-full shadow-lg opacity-80 hover:opacity-100 transition-opacity"
              onClick={scrollToTop}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
          )}

          {/* Scroll to bottom button */}
          {showScrollDown && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-8 bottom-40 z-20 rounded-full shadow-lg opacity-80 hover:opacity-100 transition-opacity"
              onClick={scrollToBottom}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          )}

          {/* Quick Actions Bar - fixed above input */}
          {messages.length > 0 && (
            <div className="px-4 pb-2 pt-2 shrink-0">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-2">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-full"
                      onClick={() => setInput(action.prompt)}
                    >
                      {action.label}
                      {getOpCost(action.costKey) !== null && (
                        <Badge variant="secondary" className="text-[10px] ml-1.5 px-1.5">
                          {getOpCost(action.costKey)}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Input Area - fixed at bottom */}
          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0 bg-background">
            {failedMessage && (
              <div className="flex items-center justify-between gap-3 mb-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
                <span className="text-xs text-destructive flex-1 min-w-0">
                  Your last message didn't send. Tap Retry to send it again.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => {
                    const msg = failedMessage;
                    setFailedMessage(null);
                    handleSend(msg);
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask ProjectPal AI anything... (Shift+Enter for new line)"
                disabled={isLoading}
                className="min-h-[40px] max-h-[120px] resize-none rounded-2xl py-2"
                rows={1}
                style={{ height: "auto", overflowY: "auto" }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }
                }}
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="rounded-full shrink-0"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Mobile Sidebar Overlay */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setShowSidebar(false)} />
      )}

      {isMobile ? (
        <>
          {/* Mobile: keep existing overlay sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-in-out ${showSidebar ? "translate-x-0" : "-translate-x-full"}`}
          >
            {sidebarContent}
          </div>
          {mainChatContent}
        </>
      ) : (
        /* Desktop: resizable panels */
        <ResizablePanelGroup direction="horizontal" className="h-screen">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            {sidebarContent}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={80}>
            {mainChatContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteSessionId}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteSessionId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSession();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;
