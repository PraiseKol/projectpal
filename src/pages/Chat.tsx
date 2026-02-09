import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Send, ArrowLeft, GraduationCap, Sparkles, MessageSquare, Plus, Menu, X, Trash2, Copy, Check, FastForward } from "lucide-react";
import { toast } from "sonner";
import { TypingEffect } from "@/components/TypingEffect";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportOptions } from "@/components/ExportOptions";
import { translateError, logError } from "@/utils/errorMessages";

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

const Chat = () => {
  const navigate = useNavigate();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a title from the first user message
  const generateTitle = (message: string): string => {
    const cleaned = message.trim().replace(/\s+/g, ' ');
    if (cleaned.length <= 35) return cleaned;
    const truncated = cleaned.substring(0, 35);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 15 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  };

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    // Show sidebar by default on desktop
    if (!isMobile) {
      setShowSidebar(true);
    }
  }, [isMobile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initializeChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      setProfile(profileData);

      // Load chat sessions
      await loadChatSessions(user.id);

      // Check if there's a session_id in URL params
      const urlSessionId = searchParams.get("session_id");
      
      if (urlSessionId) {
        // Load existing session
        await loadSession(urlSessionId);
      } else {
        // Create new session
        const { data: session, error } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, title: "New Chat" })
          .select()
          .single();

        if (error) throw error;
        setSessionId(session.id);
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

  const loadSession = async (sessionId: string) => {
    try {
      setSessionId(sessionId);

      // Load messages for this session
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Close sidebar on mobile after selecting a chat
      if (isMobile) {
        setShowSidebar(false);
      }
    } catch (error) {
      logError("Chat:loadSession", error);
      toast.error(translateError(error));
    }
  };

  const createNewChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: session, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title: "New Chat" })
        .select()
        .single();

      if (error) throw error;
      
      setSessionId(session.id);
      setMessages([]);
      await loadChatSessions(user.id);
      navigate(`/chat?session_id=${session.id}`);
      
      // Close sidebar on mobile after creating new chat
      if (isMobile) {
        setShowSidebar(false);
      }
    } catch (error) {
      logError("Chat:createNewChat", error);
      toast.error(translateError(error));
    }
  };

  const handleDeleteSession = async () => {
    // Capture the ID immediately before any state changes
    const sessionToDelete = deleteSessionId;
    if (!sessionToDelete) return;

    setIsDeleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete messages first (due to foreign key)
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("session_id", sessionToDelete);

      if (messagesError) {
        logError("Chat:deleteMessages", messagesError);
      }

      // Then delete the session
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionToDelete);

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
      const { error } = await supabase
        .from("chat_sessions")
        .update({ title: trimmedTitle })
        .eq("id", sessionId);

      if (error) throw error;

      setChatSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, title: trimmedTitle } : s)
      );
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

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    // Check credits - updated logic for paid_credits
    const hasCredits = profile?.daily_credits > 0 || 
      (profile?.plan_type === 'free' && profile?.monthly_credits > 0) ||
      (profile?.plan_type !== 'free' && profile?.paid_credits > 0);

    if (!hasCredits) {
      toast.error("You've run out of credits! Upgrade your plan to continue.");
      navigate("/pricing");
      return;
    }

    const userMessage = input.trim();
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
      await supabase.from("messages").insert({
        session_id: sessionId,
        sender: "user",
        content: userMessage,
      });

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke("chat-ai", {
        body: { message: userMessage, session_id: sessionId },
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
      if (isFirstMessage && sessionId) {
        // Use AI-generated title from response, fallback to local generation
        const title = data.generated_title || generateTitle(userMessage);
        await supabase
          .from("chat_sessions")
          .update({ title })
          .eq("id", sessionId);
        
        // Update local state
        setChatSessions(prev => 
          prev.map(s => s.id === sessionId ? { ...s, title } : s)
        );
      }

      // Update profile credits
      setProfile((prev: any) => ({ ...prev, ...data.profile }));
    } catch (error: any) {
      logError("Chat:sendMessage", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Generate Project Topic", prompt: "Generate a project topic for my field of study" },
    { label: "Search for Articles", prompt: "Search for academic articles about [your topic here]" },
    { label: "Write Proposal", prompt: "Help me write a research proposal" },
    { label: "Write Chapter 1 (Introduction)", prompt: "Help me write Chapter 1: Introduction for my project" },
    { label: "Write Chapter 2 (Literature Review)", prompt: "Help me write Chapter 2: Literature Review" },
    { label: "Write Chapter 3 (Methodology)", prompt: "Help me write Chapter 3: Methodology" },
    { label: "Edit Chapter 4 (Results/Discussion)", prompt: "Help me edit and improve Chapter 4: Results and Discussion" },
    { label: "Write Chapter 5 (Conclusion)", prompt: "Help me write Chapter 5: Conclusion and Recommendations" },
    { label: "Generate References", prompt: "Generate academic references in APA format" },
  ];

  // Get display credits based on plan type
  const getCreditsDisplay = () => {
    if (profile?.plan_type === 'free') {
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
    return docPatterns.some(pattern => pattern.test(content)) || content.length > 500;
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Mobile Sidebar Overlay */}
      {isMobile && showSidebar && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
          w-64 bg-background border-r border-border flex flex-col transition-transform duration-300 ease-in-out
        `}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Button onClick={createNewChat} className="flex-1" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
          {isMobile && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-2"
              onClick={() => setShowSidebar(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 rounded-xl ${session.id === sessionId ? 'bg-secondary' : 'hover:bg-accent/50'}`}
              >
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
                    className="flex-1 justify-start text-left h-auto py-2 px-3 rounded-xl"
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
                    <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate text-sm">{session.title}</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 shrink-0 mr-1 transition-opacity ${
                    isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteSessionId(session.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile hamburger menu */}
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden"
                onClick={() => setShowSidebar(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
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

        {/* Chat Area */}
        <div className="flex-1 px-4 py-6 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl font-bold mb-2">Welcome to ProjectPal</h2>
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
                      <div>
                        <div className="font-semibold">{action.label}</div>
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
                          <TypingEffect
                            text={msg.content}
                            onComplete={() => setTypingMessageId(null)}
                          >
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
                          <div className="mt-3 flex justify-end gap-1">
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
                            <ExportOptions 
                              content={msg.content} 
                              chatTitle={chatSessions.find(s => s.id === sessionId)?.title}
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

          {/* Quick Actions Bar */}
          {messages.length > 0 && (
            <div className="mb-4">
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
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border pt-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask ScholarAI anything..."
                disabled={isLoading}
                className="rounded-full"
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon" className="rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setDeleteSessionId(null);
        }
      }}>
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
