import { useState } from "react";
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
  Trash2
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

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

const mockDocuments = [
  { id: 1, name: "Financial Report Q4.pdf", size: "2.4 MB", status: "processed" },
  { id: 2, name: "Market Analysis.docx", size: "1.8 MB", status: "processing" },
  { id: 3, name: "Technical Specs.txt", size: "456 KB", status: "processed" },
];

export function AppSidebar() {
  const sidebar = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-primary font-medium border-r-2 border-sidebar-primary" 
      : "hover:bg-sidebar-accent/50 text-sidebar-foreground";

  const filteredDocuments = mockDocuments.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCollapsed = !sidebar.open;

  return (
    <Sidebar 
      className={`transition-all duration-300 ease-in-out ${isCollapsed ? "w-14" : "w-80"}`}
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
                      <NavLink to={item.url} end className={getNavCls}>
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

              {/* Document Upload */}
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium flex items-center justify-between">
                  Documents
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-sidebar-accent">
                    <Plus className="h-3 w-3" />
                  </Button>
                </SidebarGroupLabel>
                
                <div className="px-2 mb-3">
                  <Button className="w-full bg-gradient-primary hover:bg-primary-hover text-white shadow-sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </div>

                {/* Document Search */}
                <div className="px-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-sidebar-accent border-sidebar-border focus:border-sidebar-primary"
                    />
                  </div>
                </div>

                {/* Document List */}
                <SidebarGroupContent>
                  <div className="space-y-2 px-2 max-h-60 overflow-y-auto">
                    {filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer group"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-sidebar-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-sidebar-foreground truncate">
                              {doc.name}
                            </p>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-sidebar-foreground/60">{doc.size}</p>
                              <Badge 
                                variant={doc.status === "processed" ? "default" : "secondary"}
                                className="text-xs h-4"
                              >
                                {doc.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </SidebarGroupContent>
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
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {!isCollapsed && (
                  <SidebarMenuItem>
                    <SidebarMenuButton className="text-destructive hover:bg-destructive/10 hover:text-destructive">
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