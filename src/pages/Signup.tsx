import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().min(7, "Phone number is required").max(20),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const countryCodes = [
  { code: "+880", country: "BD" },
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "IN" },
  { code: "+61", country: "AU" },
  { code: "+81", country: "JP" },
  { code: "+86", country: "CN" },
];

export default function Signup() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [countryCode, setCountryCode] = useState("+880");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  // Validate invite token and show role
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      // No invite token - this is the initial main_admin signup (allowed)
      return;
    }
    // Validate invite token
    (async () => {
      const { data, error } = await supabase
        .from("invitations" as any)
        .select("role, used_by, expires_at")
        .eq("token", inviteToken)
        .single();
      if (error || !data) {
        setInviteValid(false);
        return;
      }
      const inv = data as any;
      if (inv.used_by || new Date(inv.expires_at) < new Date()) {
        setInviteValid(false);
        return;
      }
      setInviteRole(inv.role === "sub_admin" ? "Sub Admin" : inv.role === "moderator" ? "Moderator" : inv.role);
      setInviteValid(true);
    })();
  }, [inviteToken]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // If there's an invite token, it must be valid
    if (inviteToken && inviteValid === false) {
      toast({ title: "Invalid invite", description: "This invite link is invalid or expired.", variant: "destructive" });
      return;
    }

    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!agreed) {
      toast({ title: "Terms required", description: "You must agree to the terms and conditions.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const fullPhone = `${countryCode}${form.phone}`;
    const normalizedEmail = form.email.trim().toLowerCase();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: form.password,
      options: {
        data: { name: form.name, phone: fullPhone, invite_token: inviteToken || undefined },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // If invite token exists, call the accept-invite edge function
    if (inviteToken && signUpData.user) {
      const { data: acceptData, error: acceptError } = await supabase.functions.invoke("accept-invite", {
        body: { token: inviteToken, auth_user_id: signUpData.user.id },
      });
      if (acceptError || acceptData?.error) {
        toast({
          title: "Invite processing failed",
          description: acceptData?.error || acceptError?.message || "Could not process invite. Contact admin.",
          variant: "destructive",
        });
      }
    }

    navigate("/verify-email", { state: { email: normalizedEmail } });
    setLoading(false);
  };

  // Show error if invite is invalid
  if (inviteToken && inviteValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Card className="glass-card w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">Invalid Invite Link</CardTitle>
            <CardDescription>This invite link is invalid, expired, or has already been used.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-secondary hover:underline font-medium">Back to login</Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show loading while validating invite
  if (inviteToken && inviteValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <span className="text-2xl font-bold text-secondary-foreground">N</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="mt-2 text-muted-foreground">Get started with Nexus AI</p>
          {inviteRole && (
            <Badge className="mt-3 bg-secondary text-secondary-foreground text-sm px-3 py-1">
              You are signing up as: {inviteRole}
            </Badge>
          )}
        </div>

        <Card className="glass-card">
          <form onSubmit={handleSignup}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Sign Up</CardTitle>
              <CardDescription>Fill in your details to register</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="John Doe" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className="bg-background/50 border-border text-card-foreground" />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className="bg-background/50 border-border text-card-foreground" />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-[100px] shrink-0 rounded-md border border-border bg-background/50 px-2 py-2 text-sm text-card-foreground"
                  >
                    {countryCodes.map((c) => (
                      <option key={c.code} value={c.code}>{c.country} {c.code}</option>
                    ))}
                  </select>
                  <Input id="phone" type="tel" placeholder="1234567890" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className="flex-1 bg-background/50 border-border text-card-foreground" />
                </div>
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={(e) => handleChange("password", e.target.value)} className="bg-background/50 border-border text-card-foreground pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-card-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} className="bg-background/50 border-border text-card-foreground" />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-1" />
                <Label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground cursor-pointer">
                  I agree to the Terms of Service and Privacy Policy
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-secondary hover:underline font-medium">Sign in</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
