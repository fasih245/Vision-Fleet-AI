import { Layout } from "@/components/ui/layout";
import { ChatInterface } from "@/components/chat/chat-interface";

const Index = () => {
  return (
    <Layout>
      <div className="h-full flex flex-col">
        <ChatInterface />
      </div>
    </Layout>
  );
};

export default Index;
