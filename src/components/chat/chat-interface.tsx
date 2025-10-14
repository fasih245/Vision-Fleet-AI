import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Copy, ThumbsUp, ThumbsDown, RefreshCw, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sendChatMessage } from "@/lib/api";
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
  const [isRAGEnabled, setIsRAGEnabled] = useState(true);
  const [isTogglingRAG, setIsTogglingRAG] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      const loadedMessages = await dbOperations.getMessages(conversationId);
      setMessages(loadedMessages.map(msg => ({
        id: msg.id,
        role: msg.user_message ? "user" : "assistant",
        content: msg.user_message || msg.assistant_response || "",
        timestamp: new Date(msg.created_at),
        sources: msg.sources,
      })));
    } catch (error) {
      console.error("Error loading messages:", error);
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
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Send to backend
      const response = await sendChatMessage(userMessage, isRAGEnabled);

      // Add assistant response
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources || [],
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save to database if we have a conversation
      if (conversationId) {
        await dbOperations.saveMessage(
         conversationId,
         userMessage,
         response.answer,
         response.sources
);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
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
      handleSend(e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* RAG Toggle Header */}
      <div className={`flex-shrink-0 border-b p-4 transition-all duration-300 ${
        isRAGEnabled 
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
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4">
              <Bot className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Start a conversation</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Ask questions about your documents or have a general conversation
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <Card key={message.id} className={`p-4 ${
              message.role === "user" 
                ? "bg-primary/5 ml-auto max-w-[80%]" 
                : "bg-muted/50 mr-auto max-w-[80%]"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                }`}>
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {message.sources.map((source, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          📄 {source.source}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content)}
                      className="h-6 px-2"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
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
              placeholder="Ask a question about your documents..."
              disabled={isLoading}
              className="flex-1 bg-background pointer-events-auto"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
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