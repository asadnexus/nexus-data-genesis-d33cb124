import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <span className="text-2xl font-bold text-secondary-foreground">N</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Reset Password</h1>
          <p className="mt-2 text-muted-foreground">Nexus AI</p>
        </div>

        <Card className="glass-card">
          {sent ? (
            <>
              <CardHeader className="pb-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20">
                  <Mail className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  We've sent a password reset link to{" "}
                  <strong className="text-card-foreground">{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click the link in your email to reset your password. If you don't see it, check your spam folder.
                </p>
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
                  <ArrowLeft className="h-3 w-3" /> Back to login
                </Link>
              </CardContent>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Forgot Password</CardTitle>
                <CardDescription>Enter your email to receive a reset link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@nexusai.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 border-border text-card-foreground"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
                  <ArrowLeft className="h-3 w-3" /> Back to login
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
