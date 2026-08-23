import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/ui/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { dbOperations } from "@/lib/supabase";
import {
  MessageSquare,
  Search,
  Trash2,
  RefreshCw,
  Plus,
  History as HistoryIcon,
  Pencil,
} from "lucide-react";

const History = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const convs = await dbOperations.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenConversation = (conversationId: string) => {
    // The chat page restores whichever conversation ID is in localStorage
    // on load — reuse that mechanism rather than adding a separate route param.
    localStorage.setItem("lastConversationId", conversationId);
    navigate("/");
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation? This can't be undone.")) return;

    try {
      await dbOperations.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed",
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

  const handleStartEdit = (conv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || "Untitled Chat");
  };

  const handleCancelEdit = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingTitle("");
  };

  const handleSaveTitle = async (conversationId: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const trimmed = editingTitle.trim();

    if (!trimmed) {
      handleCancelEdit();
      return;
    }

    const original = conversations.find((c) => c.id === conversationId)?.title;
    if (trimmed === original) {
      setEditingId(null);
      return;
    }

    // Update locally right away so the UI feels instant, then persist.
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: trimmed } : c))
    );
    setEditingId(null);

    try {
      await dbOperations.updateConversation(conversationId, { title: trimmed });
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast({
        title: "Error",
        description: "Failed to rename conversation",
        variant: "destructive",
      });
      // Revert on failure
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: original } : c))
      );
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await dbOperations.createConversation("New Chat");
      localStorage.setItem("lastConversationId", newConv.id);
      navigate("/");
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start a new conversation",
        variant: "destructive",
      });
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    (conv.title || "Untitled Chat").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chat History</h1>
            <p className="text-muted-foreground mt-1">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={handleNewConversation}
            className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Empty state */}
        {filteredConversations.length === 0 && (
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <HistoryIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No matching conversations" : "No conversations yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Start a new chat to begin building your history"}
              </p>
              {!searchQuery && (
                <Button onClick={handleNewConversation} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Start a conversation
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conversation list */}
        {filteredConversations.length > 0 && (
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-0">
              <div className="space-y-0">
                {filteredConversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    onClick={() => handleOpenConversation(conv.id)}
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors group ${
                      index !== filteredConversations.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === conv.id ? (
                          <Input
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => handleSaveTitle(conv.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTitle(conv.id, e);
                              if (e.key === "Escape") handleCancelEdit(e);
                            }}
                            className="h-7 text-sm font-medium"
                          />
                        ) : (
                          <h3 className="font-medium text-foreground truncate">
                            {conv.title || "Untitled Chat"}
                          </h3>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Last updated {new Date(conv.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={(e) => handleStartEdit(conv, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default History;
