import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Copy, RefreshCw, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sendChatMessage, loadConversationMessages } from "@/lib/api";
import { dbOperations } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const [isRAGEnabled, setIsRAGEnabled] = useState(true);
  const [isTogglingRAG, setIsTogglingRAG] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      // Clear messages if no conversation selected
      setMessages([]);
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          if (msg.assistant_response) {
            loadedMessages.push({
              id: `${msg.id}-assistant`,
              role: "assistant",
              content: msg.assistant_response,
              timestamp: new Date(msg.created_at),
              sources: msg.sources || [],
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
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await sendChatMessage({
        question: userMessage,
        use_rag: isRAGEnabled,
        conversation_id: conversationId,
      });

      // Add assistant response
      const assistantMsg: Message = {
        id: `temp-${Date.now()}-assistant`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources || [],
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
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
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());

    return lines.map((line, index) => {
      const trimmedLine = line.trim();

      const isHeader = /^#{1,6}\s/.test(trimmedLine) ||
        (trimmedLine.length < 100 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3);

      const isListItem = /^[-*•]\s/.test(trimmedLine) || /^\d+\.\s/.test(trimmedLine);

      const isCodeBlock = trimmedLine.startsWith('```');

      if (isHeader) {
        return (
          <h3 key={index} className="font-semibold text-base mt-4 mb-2 first:mt-0">
            {trimmedLine.replace(/^#{1,6}\s/, '')}
          </h3>
        );
      } else if (isListItem) {
        return (
          <li key={index} className="ml-4 mb-1">
            {trimmedLine.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '')}
          </li>
        );
      } else if (isCodeBlock) {
        return (
          <pre key={index} className="bg-muted p-2 rounded my-2 overflow-x-auto">
            <code>{trimmedLine.replace(/```/g, '')}</code>
          </pre>
        );
      } else {
        return (
          <p key={index} className="mb-3 leading-relaxed">
            {trimmedLine}
          </p>
        );
      }
    });
  };

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
                    {formatMessageContent(message.content)}
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
              placeholder={conversationId ? "Ask a question about your documents..." : "Select a conversation first..."}
              disabled={isLoading || !conversationId}
              className="flex-1 bg-background pointer-events-auto"
            />
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