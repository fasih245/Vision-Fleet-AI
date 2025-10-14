import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, FileText, MessageSquare, Clock, RefreshCw } from "lucide-react";
import { dbOperations } from "@/lib/supabase";

export function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalDocuments: 0,
    avgResponseTime: 0,
    totalConversations: 0,
  });
  const [documents, setDocuments] = useState<any[]>([]);
  const [recentQueries, setRecentQueries] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Load documents
      const docs = await dbOperations.getDocuments();
      setDocuments(docs);

      // Load conversations
      const conversations = await dbOperations.getConversations();

      // Load all messages and calculate stats
      let totalMessages = 0;
      let totalResponseTime = 0;
      let responseCount = 0;
      const allMessages: any[] = [];

      for (const conv of conversations) {
        const messages = await dbOperations.getMessages(conv.id);
        totalMessages += messages.length;
        
        messages.forEach(msg => {
          if (msg.response_time_ms) {
            totalResponseTime += msg.response_time_ms;
            responseCount++;
          }
          allMessages.push({
            ...msg,
            conversation_title: conv.title
          });
        });
      }

      // Calculate average response time
      const avgResponseTime = responseCount > 0 
        ? (totalResponseTime / responseCount / 1000).toFixed(1) 
        : 0;

      // Get most recent queries
      const sortedMessages = allMessages
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setRecentQueries(sortedMessages);

      setStats({
        totalMessages,
        totalDocuments: docs.length,
        avgResponseTime: parseFloat(avgResponseTime.toString()),
        totalConversations: conversations.length,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group documents by type
  const documentsByType = documents.reduce((acc: any, doc) => {
    const type = doc.file_type || 'unknown';
    const simplified = type.includes('pdf') ? 'PDF' 
      : type.includes('word') || type.includes('document') ? 'Word Documents'
      : type.includes('text') ? 'Text Files'
      : type.includes('csv') ? 'CSV Files'
      : 'Other';
    
    acc[simplified] = (acc[simplified] || 0) + 1;
    return acc;
  }, {});

  const documentUsage = Object.entries(documentsByType).map(([name, count], index) => ({
    name,
    count: count as number,
    color: ['#0ea5e9', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'][index % 5]
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background max-h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your document usage and query insights</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
          onClick={loadAnalytics}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all conversations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Uploaded</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total processed documents
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalConversations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total chat sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.avgResponseTime}s</div>
            <p className="text-xs text-success flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              RAG + Groq powered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Documents</CardTitle>
            <CardDescription>Latest uploaded documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.slice(0, 6).map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.chunk_count || 0} chunks • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={doc.is_processed ? "default" : "secondary"}>
                    {doc.is_processed ? "Processed" : "Processing"}
                  </Badge>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No documents uploaded yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Types */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Document Types</CardTitle>
            <CardDescription>Distribution by file type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documentUsage.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.count} files</p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {((item.count / stats.totalDocuments) * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
              {documentUsage.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No documents to analyze</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Queries */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Queries</CardTitle>
          <CardDescription>Latest questions asked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentQueries.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-primary">{index + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.user_message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()} • {item.response_time_ms ? `${(item.response_time_ms / 1000).toFixed(1)}s` : 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="ml-2">
                  {item.model_used?.includes('llama') ? 'Llama' : 'GPT'}
                </Badge>
              </div>
            ))}
            {recentQueries.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No queries yet. Start a conversation!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}