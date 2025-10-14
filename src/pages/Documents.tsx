import { useState, useEffect } from "react";
import { Layout } from "@/components/ui/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Search, 
  FileText, 
  Trash2, 
  Download, 
  Eye,
  Filter,
  Grid,
  List,
  RefreshCw
} from "lucide-react";
// import { dbOperations } from "@/lib/supbase";
import { uploadDocument } from "@/lib/api";
import { dbOperations } from "@/lib/supabase";

const Documents = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<"all" | "processed" | "processing" | "failed">("all");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await dbOperations.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['.pdf', '.docx', '.txt', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, TXT, or CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // First, save document metadata to Supabase
      const doc = await dbOperations.saveDocument(
        file.name,
        '', // Content will be processed
        'file',
        file.name,
        file.size,
        file.type
      );

      // Upload to backend (FAISS + processing)
      const response = await uploadDocument(file);

      // Update document with processing results
      await dbOperations.updateDocumentProcessing(
        doc.id,
        response.chunks_created,
        true
      );

      toast({
        title: "Upload successful",
        description: `${file.name} uploaded and processed (${response.chunks_created} chunks created)`,
      });

      // Reload documents
      await loadDocuments();

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }

    try {
      await dbOperations.deleteDocument(documentId);
      
      toast({
        title: "Document deleted",
        description: `${documentName} has been deleted`,
      });

      // Reload documents
      await loadDocuments();

    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const status = doc.is_processed ? "processed" : "processing";
    const matchesFilter = filterStatus === "all" || status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (isProcessed: boolean) => {
    return isProcessed 
      ? "bg-success text-success-foreground" 
      : "bg-warning text-warning-foreground";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const processedCount = documents.filter(d => d.is_processed).length;
  const processingCount = documents.filter(d => !d.is_processed).length;

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground mt-1">Manage and analyze your uploaded documents</p>
          </div>
          <div>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button 
                className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
                disabled={isUploading}
                asChild
              >
                <span>
                  {isUploading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? "Uploading..." : "Upload Documents"}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground">{documents.length}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold text-success">{processedCount}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-success"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Processing</p>
                  <p className="text-2xl font-bold text-warning">{processingCount}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-warning"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Chunks</p>
                  <p className="text-2xl font-bold text-foreground">
                    {documents.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0)}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-accent"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-background border border-border rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="processed">Processed</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {filteredDocuments.length === 0 && !isLoading && (
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search" : "Upload your first document to get started"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Documents Grid */}
        {viewMode === "grid" && filteredDocuments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="bg-gradient-card shadow-card hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <Badge className={getStatusColor(doc.is_processed)} variant="secondary">
                        {doc.is_processed ? "processed" : "processing"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg leading-tight">{doc.title}</CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-medium">{formatFileSize(doc.file_size)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Chunks</p>
                      <p className="font-medium">{doc.chunk_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">{doc.file_type || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uploaded</p>
                      <p className="font-medium">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Documents List */}
        {viewMode === "list" && filteredDocuments.length > 0 && (
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-0">
              <div className="space-y-0">
                {filteredDocuments.map((doc, index) => (
                  <div 
                    key={doc.id} 
                    className={`flex items-center justify-between p-4 ${
                      index !== filteredDocuments.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground truncate">{doc.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>{doc.chunk_count || 0} chunks</span>
                          <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(doc.is_processed)} variant="secondary">
                        {doc.is_processed ? "processed" : "processing"}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
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

export default Documents;