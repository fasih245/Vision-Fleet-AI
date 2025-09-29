import { Layout } from "@/components/ui/layout";
import { ChatInterface } from "@/components/chat/chat-interface";

const Index = () => {
  return (
    <Layout>
      <div className="h-[calc(100vh-3.5rem)]">
        <ChatInterface />
      </div>
    </Layout>
  );
};

export default Index;
