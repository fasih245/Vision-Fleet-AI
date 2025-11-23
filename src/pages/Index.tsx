import { useState, useEffect } from "react";
import { Layout } from "@/components/ui/layout";
import { ChatInterface } from "@/components/chat/chat-interface";
import { WelcomePopup } from "@/components/ui/welcome-popup";
import { RefreshCw } from "lucide-react";
import { dbOperations } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

const Index = () => {
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    initializeChat();
    checkWelcomePopup();
  }, []);

  // Persist conversation ID
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('lastConversationId', currentConversationId);
    }
  }, [currentConversationId]);

  const checkWelcomePopup = async () => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Get user profile for name
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', session.user.id)
            .single();

          // Set user name (fallback to email username if no profile)
          const name = profile?.full_name ||
            profile?.username ||
            session.user.email?.split('@')[0] ||
            "";
          setUserName(name);
        } catch (profileError) {
          console.log("No profile found, using email");
          setUserName(session.user.email?.split('@')[0] || "");
        }

        // Check if welcome should be shown
        const welcomeShown = sessionStorage.getItem('welcomeShown');

        if (!welcomeShown) {
          // Show welcome popup on first load of session
          setShowWelcome(true);
          sessionStorage.setItem('welcomeShown', 'true');
        }
      }
    } catch (error) {
      console.error("Error checking welcome popup:", error);
    }
  };

  const initializeChat = async () => {
    try {
      const docs = await dbOperations.getDocuments();
      setDocumentsCount(docs.length);

      const conversations = await dbOperations.getConversations();

      if (conversations.length > 0) {
        // Try to restore last active conversation
        const lastId = localStorage.getItem('lastConversationId');
        const lastConv = conversations.find(c => c.id === lastId);

        if (lastConv) {
          setCurrentConversationId(lastConv.id);
        } else {
          // Fallback to most recent
          setCurrentConversationId(conversations[0].id);
        }
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

  const handleCloseWelcome = () => {
    setShowWelcome(false);
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

      {/* Welcome Popup */}
      {showWelcome && (
        <WelcomePopup
          userName={userName}
          onClose={handleCloseWelcome}
        />
      )}
    </Layout>
  );
};

export default Index;