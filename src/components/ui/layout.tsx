import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

interface LayoutProps {
  children: React.ReactNode;
  conversationId?: string;
  onConversationChange?: (id: string) => void;
}

export function Layout({ children, conversationId, onConversationChange }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar 
          currentConversationId={conversationId}
          onConversationChange={onConversationChange}
        />
        
        <SidebarInset className="flex flex-col overflow-hidden">
          {/* Sticky header with toggle */}
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
          </header>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}