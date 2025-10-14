import { useState, useEffect } from "react";
import { Layout } from "@/components/ui/layout";
import { ChatInterface } from "@/components/chat/chat-interface";
// import { dbOperations } from "@/lib/supbase";
import { RefreshCw } from "lucide-react";
import { dbOperations } from "@/lib/supabase";

const Index = () => {
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      const docs = await dbOperations.getDocuments();
      setDocumentsCount(docs.length);

      const conversations = await dbOperations.getConversations();
      
      if (conversations.length > 0) {
        setCurrentConversationId(conversations[0].id);
      } else {
        const newConv = await dbOperations.createConversation("New Chat");
        setCurrentConversationId(newConv.id);
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !currentConversationId) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      conversationId={currentConversationId}
      onConversationChange={setCurrentConversationId}
    >
      <div className="h-full flex flex-col">
        <ChatInterface 
          conversationId={currentConversationId}
          documentsCount={documentsCount}
        />
      </div>
    </Layout>
  );
};

export default Index;