import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Copy, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{ document: string; page: number; excerpt: string }>;
  isTyping?: boolean;
}

const mockSources = [
  { document: "Financial Report Q4.pdf", page: 23, excerpt: "Revenue increased by 15% compared to Q3..." },
  { document: "Market Analysis.docx", page: 7, excerpt: "Market trends show strong growth in the analytics sector..." }
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! I'm your VisionFleet Analytics assistant. I can help you analyze your uploaded documents and answer questions based on their content. What would you like to know?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateTypingResponse = (content: string, sources?: typeof mockSources) => {
    const messageId = Date.now().toString();
    
    // Add typing indicator
    setMessages(prev => [...prev, {
      id: messageId,
      type: "assistant",
      content: "",
      timestamp: new Date(),
      isTyping: true
    }]);

    // Simulate typing effect
    let currentContent = "";
    const words = content.split(" ");
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
      if (wordIndex < words.length) {
        currentContent += (wordIndex > 0 ? " " : "") + words[wordIndex];
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: currentContent, isTyping: true }
            : msg
        ));
        wordIndex++;
      } else {
        clearInterval(typingInterval);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: currentContent, isTyping: false, sources }
            : msg
        ));
        setIsLoading(false);
      }
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Based on your uploaded documents, I found several relevant insights. The financial report shows a 15% revenue increase, while market analysis indicates strong growth trends in the analytics sector.",
        "I've analyzed your documents and found key information across multiple sources. The data suggests significant opportunities for growth in the current market conditions."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      simulateTypingResponse(randomResponse, mockSources);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied to clipboard",
      description: "Message content has been copied to your clipboard.",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex max-w-[80%] ${message.type === "user" ? "flex-row-reverse" : "flex-row"} items-start space-x-3`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === "user" 
                  ? "bg-chat-user text-chat-user-foreground ml-3" 
                  : "bg-chat-assistant text-chat-assistant-foreround mr-3"
              }`}>
                {message.type === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <Card className={`p-4 shadow-chat ${
                  message.type === "user" 
                    ? "bg-chat-user text-chat-user-foreground" 
                    : "bg-chat-assistant text-chat-assistant-foreground"
                }`}>
                  <div className="flex items-start justify-between">
                    <p className="text-sm leading-relaxed">
                      {message.content}
                      {message.isTyping && (
                        <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1" />
                      )}
                    </p>
                    
                    {message.type === "assistant" && !message.isTyping && (
                      <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 hover:bg-background/20"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-background/20">
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-background/20">
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Sources */}
                {message.sources && !message.isTyping && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Sources:</p>
                    {message.sources.map((source, index) => (
                      <Card key={index} className="p-3 bg-muted/50 border-l-4 border-l-accent">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {source.document}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Page {source.page}</span>
                        </div>
                        <p className="text-xs text-muted-foreground italic">{source.excerpt}</p>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your documents..."
              className="pr-12 bg-background border-border focus:border-primary"
              disabled={isLoading}
            />
            {isLoading && (
              <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputValue.trim() || isLoading}
            className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">3 documents loaded</Badge>
            <Badge variant="outline" className="text-xs">RAG Active</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}