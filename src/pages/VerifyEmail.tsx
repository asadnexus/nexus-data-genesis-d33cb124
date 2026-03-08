import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft } from "lucide-react";

export default function VerifyEmail() {
  const location = useLocation();
  const email = (location.state as any)?.email || "";
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Verification email has been resent." });
      setCooldown(60);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="glass-card text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20">
              <Mail className="h-8 w-8 text-secondary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a verification link to{" "}
              {email ? <strong className="text-card-foreground">{email}</strong> : "your email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the link in your email to verify your account. If you don't see it, check your spam folder.
            </p>
            <Button
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              variant="outline"
              className="w-full"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : loading ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
