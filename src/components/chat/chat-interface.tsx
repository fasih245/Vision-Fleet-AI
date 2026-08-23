import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Copy, RefreshCw, Sparkles, Brain, Mic, MicOff, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { streamChatMessage, loadConversationMessages } from "@/lib/api";
import { dbOperations } from "@/lib/supabase";
import { getActiveTypewriterConfig } from "@/lib/typewriter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: any[];
}

interface ChatInterfaceProps {
  conversationId?: string;
  documentsCount?: number;
}

export function ChatInterface({ conversationId, documentsCount = 0 }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRAGEnabled, setIsRAGEnabled] = useState(() => {
    const stored = localStorage.getItem("visionfleet-default-rag");
    return stored === null ? true : stored === "true";
  });
  const [isTogglingRAG, setIsTogglingRAG] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const SpeechRecognitionCtor =
    typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const speechRecognitionSupported = !!SpeechRecognitionCtor;
  const speechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      // Clear messages if no conversation selected
      setMessages([]);
    }

    // Switching conversations mid-speech would read the wrong thing
    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);

    // Also stop any in-progress typewriter reveal from the previous conversation
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stop any in-flight recognition/speech/typewriter if the component unmounts
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    };
  }, []);

  const loadMessages = async () => {
    if (!conversationId) return;

    setIsLoadingHistory(true);

    try {
      console.log(`📥 Loading messages for conversation: ${conversationId}`);

      // Load from API
      const response = await loadConversationMessages(conversationId);

      if (response.messages && response.messages.length > 0) {
        // Transform API messages to UI format
        const loadedMessages: Message[] = [];

        response.messages.forEach((msg: any) => {
          // Add user message
          if (msg.user_message) {
            loadedMessages.push({
              id: `${msg.id}-user`,
              role: "user",
              content: msg.user_message,
              timestamp: new Date(msg.created_at),
            });
          }

          // Add assistant response
          if (msg.bot_response) {
            loadedMessages.push({
              id: `${msg.id}-assistant`,
              role: "assistant",
              content: msg.bot_response,
              timestamp: new Date(msg.created_at),
              sources: msg.retrieved_chunks || [],
            });
          }
        });

        setMessages(loadedMessages);
        console.log(`✅ Loaded ${loadedMessages.length} messages`);
      } else {
        // No messages - this is NORMAL for new conversations
        console.log("📝 No previous messages (new conversation)");
        setMessages([]);
      }

    } catch (error: any) {
      console.error("❌ Error loading messages:", error);

      // Only show error if it's NOT a 404 (conversation not found is ok)
      if (error.response?.status !== 404) {
        toast({
          title: "Note",
          description: "Starting fresh conversation",
        });
      }

      // Set empty messages (don't fail)
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleToggleRAG = () => {
    setIsTogglingRAG(true);
    setTimeout(() => {
      setIsRAGEnabled(!isRAGEnabled);
      setIsTogglingRAG(false);
      toast({
        title: isRAGEnabled ? "Conventional Chatbot Activated" : "RAG Mode Activated",
        description: isRAGEnabled
          ? "Now using general LLM without document search"
          : "Now searching your documents for context",
      });
    }, 300);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !conversationId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    // Placeholder assistant message that fills in as chunks arrive
    const assistantMsgId = `temp-${Date.now()}-assistant`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      sources: [],
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const appendToMessage = (text: string) => {
      setMessages(prev =>
        prev.map(m => (m.id === assistantMsgId ? { ...m, content: m.content + text } : m))
      );
    };

    // Typewriter: buffer incoming text and reveal it at a controlled rate,
    // independent of how fast chunks actually arrive over the network
    // (Groq is fast enough that raw pass-through looks like bursty pops
    // rather than a smooth type-out). "instant" mode skips buffering
    // entirely and behaves like the old direct-append.
    const typewriterConfig = getActiveTypewriterConfig();
    let pendingText = "";
    let streamEnded = false;

    const finishIfDrained = () => {
      if (!streamEnded || pendingText.length > 0) return;
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      setIsLoading(false);
      inputRef.current?.focus();
    };

    if (typewriterConfig) {
      typewriterTimerRef.current = setInterval(() => {
        if (pendingText.length === 0) {
          finishIfDrained();
          return;
        }
        const take = pendingText.slice(0, typewriterConfig.charsPerTick);
        pendingText = pendingText.slice(typewriterConfig.charsPerTick);
        appendToMessage(take);
        finishIfDrained();
      }, typewriterConfig.intervalMs);
    }

    try {
      await streamChatMessage(
        {
          question: userMessage,
          use_rag: isRAGEnabled,
          conversation_id: conversationId,
        },
        {
          onChunk: (text) => {
            if (typewriterConfig) {
              pendingText += text;
            } else {
              appendToMessage(text);
            }
          },
          onDone: ({ sources }) => {
            setMessages(prev =>
              prev.map(m => (m.id === assistantMsgId ? { ...m, sources } : m))
            );
            streamEnded = true;
            finishIfDrained();
          },
          onError: (message) => {
            toast({
              title: "Error",
              description: message,
              variant: "destructive",
            });
            streamEnded = true;
            pendingText = "";
            finishIfDrained();
          },
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      streamEnded = true;
      pendingText = "";
      finishIfDrained();
    } finally {
      if (!typewriterConfig) {
        setIsLoading(false);
        inputRef.current?.focus();
      }
      // In buffered mode, finishIfDrained() clears isLoading once the
      // reveal queue is empty — don't clear it early here or the typing
      // effect would keep animating after the input re-enables.
    }
  };

  const toggleListening = () => {
    if (!speechRecognitionSupported) {
      toast({
        title: "Not supported",
        description: "Voice input isn't supported in this browser — try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast({
          title: "Microphone access denied",
          description: "Allow microphone access in your browser to use voice input.",
          variant: "destructive",
        });
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        toast({
          title: "Voice input error",
          description: "Something went wrong while listening. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Strip markdown syntax before handing text to the speech synthesizer,
  // so it doesn't read out literal asterisks, hashes, pipes, etc.
  const stripMarkdownForSpeech = (markdown: string): string => {
    return markdown
      .replace(/```[\s\S]*?```/g, " ") // code blocks
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/<br\s*\/?>/gi, ". ") // literal <br> tags some responses use in tables
      .replace(/<[^>]+>/g, " ") // any other stray HTML
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> link text
      .replace(/^#{1,6}\s+/gm, "") // headings
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1") // italic
      .replace(/^\s*[-*•]\s+/gm, "") // bullet markers
      .replace(/^\s*\d+\.\s+/gm, "") // numbered list markers
      .replace(/\|/g, " ") // table pipes
      .replace(/^-{3,}$/gm, "") // table separator rows
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const speakMessage = (id: string, content: string) => {
    if (!speechSynthesisSupported) {
      toast({
        title: "Not supported",
        description: "Read-aloud isn't supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    window.speechSynthesis.cancel();

    if (speakingMessageId === id) {
      // Was already speaking this message — treat click as "stop"
      setSpeakingMessageId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(content));
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
    });
  };

  // Format message content with proper line breaks and structure
  const formatMessageContent = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h3 className="font-semibold text-base mt-4 mb-2 first:mt-0">{children}</h3>,
        h2: ({ children }) => <h3 className="font-semibold text-base mt-4 mb-2 first:mt-0">{children}</h3>,
        h3: ({ children }) => <h3 className="font-semibold text-base mt-4 mb-2 first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
        pre: ({ children }) => <pre className="bg-muted p-2 rounded my-2 overflow-x-auto text-xs">{children}</pre>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* RAG Toggle Header */}
      <div className={`flex-shrink-0 border-b p-4 transition-all duration-300 ${isRAGEnabled
        ? 'bg-gradient-to-r from-primary/10 to-accent/10'
        : 'bg-muted/50'
        }`}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className={`transition-transform duration-300 ${isTogglingRAG ? 'scale-110 rotate-180' : ''}`}>
              {isRAGEnabled ? (
                <Brain className="w-5 h-5 text-primary" />
              ) : (
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {isRAGEnabled ? "RAG Mode Active" : "Conventional Chatbot"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRAGEnabled
                  ? "Searching your documents for context"
                  : "General conversation without document search"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="rag-toggle" className="text-sm cursor-pointer">
              {isRAGEnabled ? "RAG" : "LLM"}
            </Label>
            <Switch
              id="rag-toggle"
              checked={isRAGEnabled}
              onCheckedChange={handleToggleRAG}
              disabled={isTogglingRAG}
            />
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading chat history...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4">
              <Bot className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Start a conversation</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {conversationId
                    ? "No messages yet. Ask your first question!"
                    : "Select or create a conversation to begin"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <Card key={message.id} className={`p-4 ${message.role === "user"
              ? "bg-primary/5 ml-auto max-w-[85%]"
              : "bg-muted/50 mr-auto max-w-[85%]"
              }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
                  }`}>
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {/* Formatted Message Content */}
                  <div className="text-sm text-foreground break-words">
                    {message.role === "assistant" && message.content === "" && isLoading ? (
                      <div className="flex items-center gap-1 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                      </div>
                    ) : (
                      formatMessageContent(message.content)
                    )}
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground font-medium">Sources:</span>
                      {message.sources.map((source, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          📄 {source.source}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content)}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span className="text-xs">Copy</span>
                    </Button>
                    {message.role === "assistant" && speechSynthesisSupported && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => speakMessage(message.id, message.content)}
                        className={`h-7 px-2 ${
                          speakingMessageId === message.id
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {speakingMessageId === message.id ? (
                          <Square className="w-3 h-3 mr-1" />
                        ) : (
                          <Volume2 className="w-3 h-3 mr-1" />
                        )}
                        <span className="text-xs">
                          {speakingMessageId === message.id ? "Stop" : "Listen"}
                        </span>
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4 z-10">
        <form onSubmit={handleSend} className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "Listening..."
                  : conversationId
                  ? "Ask a question about your documents..."
                  : "Select a conversation first..."
              }
              disabled={isLoading || !conversationId}
              className="flex-1 bg-background pointer-events-auto"
            />
            {speechRecognitionSupported && (
              <Button
                type="button"
                variant="outline"
                onClick={toggleListening}
                disabled={isLoading || !conversationId}
                className={`pointer-events-auto ${isListening ? "text-destructive border-destructive animate-pulse" : ""}`}
                title={isListening ? "Stop listening" : "Speak your question"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || !conversationId}
              className="bg-gradient-primary hover:bg-primary-hover text-white pointer-events-auto"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {documentsCount} document{documentsCount !== 1 ? "s" : ""} loaded
              </Badge>
              <Badge
                variant={isRAGEnabled ? "default" : "outline"}
                className="text-xs"
              >
                {isRAGEnabled ? "RAG Active" : "LLM Only"}
              </Badge>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}