import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className={cn("flex-1 transition-smooth", className)}>
          <header className="h-14 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-accent" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">VF</span>
                </div>
                <h1 className="font-semibold text-lg text-foreground">VisionFleet Analytics</h1>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}