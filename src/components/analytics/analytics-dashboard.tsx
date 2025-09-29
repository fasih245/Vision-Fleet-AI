import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, FileText, MessageSquare, Users, Clock } from "lucide-react";

const queryData = [
  { month: "Jan", queries: 45, documents: 12 },
  { month: "Feb", queries: 67, documents: 18 },
  { month: "Mar", queries: 89, documents: 25 },
  { month: "Apr", queries: 123, documents: 31 },
  { month: "May", queries: 156, documents: 28 },
  { month: "Jun", queries: 178, documents: 35 },
];

const documentUsage = [
  { name: "Financial Reports", queries: 45, color: "#0ea5e9" },
  { name: "Market Analysis", queries: 32, color: "#06b6d4" },
  { name: "Technical Specs", queries: 28, color: "#8b5cf6" },
  { name: "Research Papers", queries: 19, color: "#10b981" },
  { name: "Other", queries: 15, color: "#f59e0b" },
];

const topQueries = [
  { query: "What was the revenue growth in Q4?", count: 23, trend: "+15%" },
  { query: "Market trends analysis summary", count: 18, trend: "+8%" },
  { query: "Technical specifications overview", count: 14, trend: "+22%" },
  { query: "Competitive analysis insights", count: 11, trend: "+5%" },
  { query: "Financial projections for next quarter", count: 9, trend: "+12%" },
];

export function AnalyticsDashboard() {
  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your document usage and query insights</p>
        </div>
        <Button className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1,234</div>
            <p className="text-xs text-success flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Processed</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">87</div>
            <p className="text-xs text-success flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">23</div>
            <p className="text-xs text-success flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +4% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">2.3s</div>
            <p className="text-xs text-success flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              -15% faster
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Trends */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Query Trends</CardTitle>
            <CardDescription>Monthly queries and document uploads over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queryData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{item.month}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.queries} queries</p>
                      <p className="text-xs text-muted-foreground">{item.documents} documents</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-16 h-2 bg-primary/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${(item.queries / 200) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Usage */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Document Usage</CardTitle>
            <CardDescription>Query distribution by document type</CardDescription>
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
                      <p className="text-xs text-muted-foreground">{item.queries} queries</p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {((item.queries / documentUsage.reduce((sum, doc) => sum + doc.queries, 0)) * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Queries Table */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Top Queries</CardTitle>
          <CardDescription>Most frequently asked questions this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topQueries.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.query}</p>
                    <p className="text-xs text-muted-foreground">{item.count} queries</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-success">
                  {item.trend}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}