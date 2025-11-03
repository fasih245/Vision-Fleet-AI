import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WelcomePopupProps {
  userName?: string;
  onClose: () => void;
}

export function WelcomePopup({ userName, onClose }: WelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <Card
        className={`relative w-full max-w-md mx-4 transform transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Sparkles className="h-12 w-12 text-primary animate-pulse" />
              <span className="absolute -top-1 -right-1 text-4xl">😊</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Welcome to VisionFleet AI!
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {userName ? (
              <>
                Hi <span className="font-semibold text-foreground">{userName}</span>! 
                We're excited to have you here.
              </>
            ) : (
              "We're excited to have you here!"
            )}
          </p>

          <div className="bg-primary/10 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Get Started:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>📄 Upload your documents</li>
              <li>💬 Ask questions about them</li>
              <li>🤖 Get AI-powered insights</li>
            </ul>
          </div>

          <Button
            onClick={handleClose}
            className="w-full bg-gradient-primary hover:bg-primary-hover"
          >
            Let's Get Started!
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}