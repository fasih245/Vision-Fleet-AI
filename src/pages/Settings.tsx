import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/ui/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { dbOperations } from "@/lib/supabase";
import { TYPEWRITER_SPEED_KEY, getStoredTypewriterSpeed, type TypewriterSpeed } from "@/lib/typewriter";
import { Sun, Moon, Monitor, Brain, Mail, LogOut, RefreshCw, Zap, Rabbit, Turtle, Gauge } from "lucide-react";

const DEFAULT_RAG_KEY = "visionfleet-default-rag";

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

const typewriterOptions: { value: TypewriterSpeed; label: string; icon: typeof Zap }[] = [
  { value: "slow", label: "Slow", icon: Turtle },
  { value: "normal", label: "Normal", icon: Gauge },
  { value: "fast", label: "Fast", icon: Rabbit },
  { value: "instant", label: "Instant", icon: Zap },
];

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [defaultRag, setDefaultRag] = useState(true);
  const [typewriterSpeed, setTypewriterSpeed] = useState<TypewriterSpeed>("normal");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem(DEFAULT_RAG_KEY);
    setDefaultRag(stored === null ? true : stored === "true");
    setTypewriterSpeed(getStoredTypewriterSpeed());

    dbOperations
      .getCurrentUser()
      .then((user) => setEmail(user?.email || ""))
      .catch((error) => console.error("Error loading user:", error))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDefaultRagChange = (checked: boolean) => {
    setDefaultRag(checked);
    localStorage.setItem(DEFAULT_RAG_KEY, String(checked));
    toast({
      title: "Preference saved",
      description: `New conversations will start with RAG mode ${checked ? "on" : "off"}`,
    });
  };

  const handleTypewriterSpeedChange = (speed: TypewriterSpeed) => {
    setTypewriterSpeed(speed);
    localStorage.setItem(TYPEWRITER_SPEED_KEY, speed);
    toast({
      title: "Preference saved",
      description:
        speed === "instant"
          ? "Responses will appear all at once, no typing effect"
          : `Responses will type out at ${speed} speed`,
    });
  };

  const handleSignOut = async () => {
    try {
      await dbOperations.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

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
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage how VisionFleet AI looks and behaves for you</p>
        </div>

        {/* Appearance */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <Sun className="w-5 h-5 mr-2" />
              Appearance
            </CardTitle>
            <CardDescription>Choose how the interface looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Chat Preferences */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <Brain className="w-5 h-5 mr-2" />
              Chat Preferences
            </CardTitle>
            <CardDescription>Defaults applied when you start a new conversation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label htmlFor="default-rag" className="text-sm font-medium cursor-pointer">
                  Start new chats in RAG mode
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, new conversations search your documents by default. You can still toggle it per-chat.
                </p>
              </div>
              <Switch id="default-rag" checked={defaultRag} onCheckedChange={handleDefaultRagChange} />
            </div>

            <div>
              <Label className="text-sm font-medium">Response typing speed</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Controls how fast the assistant's answer types out on screen. This only affects the animation —
                it doesn't change how fast the answer is generated.
              </p>
              <div className="grid grid-cols-4 gap-3">
                {typewriterOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = typewriterSpeed === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleTypewriterSpeedChange(option.value)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Account
            </CardTitle>
            <CardDescription>Signed in as {email || "unknown"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleSignOut} className="text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
