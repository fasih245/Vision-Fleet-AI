import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, supabase } from "@/lib/supabase";
import { Bot, User, Mail, Lock, Phone, Building } from "lucide-react";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Login form
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Signup form
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    company: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Sign in
        await dbOperations.signIn(loginData.email, loginData.password);
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        navigate("/");
      } else {
        // Validate required fields
        if (!signupData.fullName.trim()) {
          throw new Error("Full name is required");
        }
        if (!signupData.email.trim()) {
          throw new Error("Email is required");
        }
        if (!signupData.password || signupData.password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }

        // Sign up
        const signupResult = await dbOperations.signUp(
          signupData.email,
          signupData.password,
          {
            full_name: signupData.fullName,
            phone: signupData.phone,
            company: signupData.company,
          }
        );
        
        // Manually create profile with all fields
        if (signupResult?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: signupResult.user.id,
              email: signupData.email,
              full_name: signupData.fullName,
              username: signupData.email.split('@')[0],
              phone: signupData.phone || null,
              company: signupData.company || null,
            });
          
          if (profileError) {
            console.error("Profile creation error:", profileError);
            
            // Show warning instead of error - user created but profile needs manual fix
            toast({
              title: "Account Created (Profile Setup Pending)",
              description: "Your account was created successfully. Please check your email to verify your account.",
              variant: "default",
              duration: 8000,
            });
          } else {
            // Success - show email verification message
            toast({
              title: "Account Created Successfully! 🎉",
              description: "Please check your email for the verification link to activate your account.",
              variant: "default",
              duration: 8000,
            });
          }
        } else {
          // User object not returned - likely requires email verification
          toast({
            title: "Verification Required",
            description: "Please check your email for the verification link to activate your account.",
            variant: "default",
            duration: 8000,
          });
        }
        
        // Switch to login mode and pre-fill email
        setIsLogin(true);
        setLoginData({ email: signupData.email, password: "" });
        setSignupData({
          fullName: "",
          email: "",
          password: "",
          phone: "",
          company: "",
        });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
      // Check for specific error types
      const errorMessage = error.message?.toLowerCase() || "";
      
      // Email verification required
      if (
        errorMessage.includes("email") && 
        (errorMessage.includes("confirm") || 
         errorMessage.includes("verify") || 
         errorMessage.includes("verification"))
      ) {
        toast({
          title: "Email Verification Required",
          description: "Please check your email inbox and spam folder for the verification link.",
          variant: "default", // Yellow/warning style
          duration: 8000,
        });
      }
      // Email already registered
      else if (errorMessage.includes("already") || errorMessage.includes("exists")) {
        toast({
          title: "Email Already Registered",
          description: "This email is already in use. Please sign in or use a different email.",
          variant: "destructive",
        });
      }
      // Invalid credentials
      else if (errorMessage.includes("invalid") || errorMessage.includes("incorrect")) {
        toast({
          title: "Invalid Credentials",
          description: "The email or password you entered is incorrect.",
          variant: "destructive",
        });
      }
      // Generic error
      else {
        toast({
          title: "Error",
          description: error.message || "Authentication failed. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">VisionFleet AI</CardTitle>
            <CardDescription className="text-base mt-2">
              {isLogin ? "Welcome back! Sign in to continue." : "Create an account to get started."}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLogin ? (
            // Login Form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:bg-primary-hover text-white"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            // Signup Form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupData.fullName}
                    onChange={(e) => setSignupData(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-phone">
                  Phone Number <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={signupData.phone}
                    onChange={(e) => setSignupData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-company">
                  Company <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-company"
                    type="text"
                    placeholder="Your Company Name"
                    value={signupData.company}
                    onChange={(e) => setSignupData(prev => ({ ...prev, company: e.target.value }))}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:bg-primary-hover text-white"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  📧 After signing up, you'll receive a verification email. Please check your inbox (and spam folder) to activate your account.
                </p>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                // Reset forms when switching
                setLoginData({ email: "", password: "" });
                setSignupData({ fullName: "", email: "", password: "", phone: "", company: "" });
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              disabled={isLoading}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;