import { Layout } from "@/components/ui/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, supabase } from "@/lib/supabase";
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar,
  Edit,
  Save,
  Camera,
  Shield,
  Key,
  Bell,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    bio: "",
    avatar_url: "",
  });

  const [stats, setStats] = useState({
    documents: 0,
    queries: 0,
    conversations: 0,
    daysActive: 0,
  });

  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const user = await dbOperations.getCurrentUser();
      if (user) {
        setUserId(user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore "not found" error
          throw error;
        }

        if (profile) {
          setFormData({
            name: profile.full_name || user.email?.split('@')[0] || "User",
            email: user.email || "",
            phone: profile.phone || "",
            company: profile.company || "",
            role: profile.role || "Analyst",
            bio: profile.bio || "",
            avatar_url: profile.avatar_url || "",
          });
        } else {
          // Profile doesn't exist yet, use defaults
          setFormData({
            name: user.email?.split('@')[0] || "User",
            email: user.email || "",
            phone: "",
            company: "",
            role: "Analyst",
            bio: "",
            avatar_url: "",
          });
        }
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [documents, conversations] = await Promise.all([
        dbOperations.getDocuments(),
        dbOperations.getConversations(),
      ]);

      // Count total messages across all conversations
      let totalQueries = 0;
      for (const conv of conversations) {
        const messages = await dbOperations.getMessages(conv.id);
        totalQueries += messages.length;
      }

      // Calculate days active
      const user = await dbOperations.getCurrentUser();
      const daysActive = user?.created_at 
        ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        documents: documents.length,
        queries: totalQueries,
        conversations: conversations.length,
        daysActive,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone || null,
          company: formData.company || null,
          bio: formData.bio || null,
          role: formData.role || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
      });
      setIsEditing(false);
      
      // Reload profile to show updated data
      await loadProfile();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const statsDisplay = [
    { label: "Documents Analyzed", value: stats.documents, icon: "📄" },
    { label: "Total Messages", value: stats.queries, icon: "💬" },
    { label: "Conversations", value: stats.conversations, icon: "💡" },
    { label: "Days Active", value: stats.daysActive, icon: "📅" },
  ];

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
      <div className="p-6 max-w-4xl mx-auto space-y-6 overflow-y-auto max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
          </div>
          <Button 
            onClick={isEditing ? handleSave : () => setIsEditing(true)}
            className="bg-gradient-primary hover:bg-primary-hover text-white shadow-sm"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Basic Information
                </CardTitle>
                <CardDescription>Your personal details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-muted" : ""}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled={true}
                        className="pl-10 bg-muted"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!isEditing}
                        className={`pl-10 ${!isEditing ? "bg-muted" : ""}`}
                        placeholder="Add phone number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        disabled={!isEditing}
                        className={`pl-10 ${!isEditing ? "bg-muted" : ""}`}
                        placeholder="Add company name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-muted" : ""}
                      placeholder="Your role or position"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-border rounded-md text-sm resize-none h-24 ${!isEditing ? "bg-muted" : "bg-background"}`}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Account Settings
                </CardTitle>
                <CardDescription>Security and account preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Key className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Password</p>
                      <p className="text-xs text-muted-foreground">Manage via Supabase dashboard</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Notifications</p>
                      <p className="text-xs text-muted-foreground">Email and push notifications</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card className="bg-gradient-card shadow-card">
              <CardContent className="p-6 text-center">
                <div className="relative inline-block mb-4">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={formData.avatar_url} />
                    <AvatarFallback className="bg-gradient-primary text-white text-2xl">
                      {formData.name.split(' ').map(n => n[0]).join('').toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      size="sm"
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0 bg-primary hover:bg-primary-hover"
                      disabled
                      title="Avatar upload coming soon"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <h3 className="text-xl font-semibold text-foreground">{formData.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{formData.role}</p>
                {formData.company && (
                  <Badge variant="secondary" className="mb-4">{formData.company}</Badge>
                )}
                
                <div className="flex items-center justify-center text-sm text-muted-foreground mt-4">
                  <Calendar className="w-4 h-4 mr-1" />
                  {stats.daysActive} {stats.daysActive === 1 ? 'day' : 'days'} active
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="text-foreground">Activity Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {statsDisplay.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{stat.icon}</span>
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;