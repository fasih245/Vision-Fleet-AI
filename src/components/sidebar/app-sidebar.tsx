import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Settings, 
  Upload,
  History,
  User,
  LogOut,
  Plus,
  Search,
  Trash2,
  RefreshCw
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
// import { dbOperations, supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/api";
import { dbOperations } from "@/lib/supabase";

const mainNavItems = [
  { title: "Chat", url: "/", icon: MessageSquare },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "History", url: "/history", icon: History },
];

const settingsItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  currentConversationId?: string;
  onConversationChange?: (conversationId: string) => void;
}

export function AppSidebar({ currentConversationId, onConversationChange }: AppSidebarProps) {
  const sidebar = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [convs, docs] = await Promise.all([
        dbOperations.getConversations(),
        dbOperations.getDocuments()
      ]);
      setConversations(convs);
      setDocuments(docs);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await dbOperations.createConversation("New Chat");
      setConversations([newConv, ...conversations]);
      
      if (onConversationChange) {
        onConversationChange(newConv.id);
      }
      navigate("/");
      
      toast({
        title: "New conversation",
        description: "Started a new chat",
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Delete this conversation?")) return;

    try {
      await dbOperations.deleteConversation(convId);
      setConversations(conversations.filter(c => c.id !== convId));
      
      if (currentConversationId === convId) {
        // If deleting current conversation, create a new one
        await handleNewConversation();
      }
      
      toast({
        title: "Conversation deleted",
        description: "Conversation has been removed",
      });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // The backend owns document metadata end-to-end (create -> process ->
      // update chunk count -> rollback on failure) — don't also insert a
      // row here, or every upload creates two duplicate document rows.
      const response = await uploadDocument(file);

      toast({
        title: "Upload successful",
        description: `${file.name} uploaded (${response.chunks_created} chunks)`,
      });

      await loadData();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSignOut = async () => {
    try {
      await dbOperations.signOut();
      navigate("/login");
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const isCollapsed = !sidebar.open;

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sidebar 
      className="border-r border-sidebar-border transition-all duration-300 ease-in-out"
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar border-r border-sidebar-border flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className={`text-sidebar-foreground/70 font-medium ${isCollapsed ? "sr-only" : ""}`}>
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        end 
                        className={({ isActive }) =>
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-primary font-medium border-r-2 border-sidebar-primary" 
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                        }
                      >
                        <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {!isCollapsed && (
            <>
              <Separator className="my-4 bg-sidebar-border" />

              {/* Conversations */}
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium flex items-center justify-between">
                  Recent Chats
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                    onClick={handleNewConversation}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </SidebarGroupLabel>

                <div className="px-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search chats..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-sidebar-accent border-sidebar-border focus:border-sidebar-primary"
                    />
                  </div>
                </div>

                <SidebarGroupContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-1 px-2 max-h-60 overflow-y-auto">
                      {filteredConversations.slice(0, 10).map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            if (onConversationChange) {
                              onConversationChange(conv.id);
                            }
                            navigate("/");
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group ${
                            currentConversationId === conv.id 
                              ? 'bg-sidebar-accent' 
                              : 'hover:bg-sidebar-accent/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <MessageSquare className="h-4 w-4 text-sidebar-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {conv.title || "Untitled Chat"}
                              </p>
                              <p className="text-xs text-sidebar-foreground/60">
                                {new Date(conv.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="my-4 bg-sidebar-border" />

              {/* Document Upload */}
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium">
                  Quick Actions
                </SidebarGroupLabel>
                
                <div className="px-2 mb-3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                    id="sidebar-file-upload"
                  />
                  <label htmlFor="sidebar-file-upload">
                    <Button 
                      className="w-full bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
                      disabled={isUploading}
                      asChild
                    >
                      <span>
                        {isUploading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isUploading ? "Uploading..." : "Upload Document"}
                      </span>
                    </Button>
                  </label>
                </div>

                <div className="px-2 text-xs text-sidebar-foreground/60">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                </div>
              </SidebarGroup>
            </>
          )}
        </div>

        {/* Settings at bottom */}
        <div className="border-t border-sidebar-border mt-auto">
          <SidebarGroup>
            <SidebarGroupLabel className={`text-sidebar-foreground/70 font-medium ${isCollapsed ? "sr-only" : ""}`}>
              Account
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url}
                        className={({ isActive }) =>
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-primary font-medium border-r-2 border-sidebar-primary" 
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                        }
                      >
                        <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {!isCollapsed && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      <span>Sign Out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}