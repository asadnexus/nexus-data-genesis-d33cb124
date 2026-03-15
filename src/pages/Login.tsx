import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: { emailRedirectTo: `${window.location.origin}/verify-email` },
        });
        toast({
          title: "Email not confirmed",
          description: `Please check your email spelling and confirm your inbox. A new verification link was sent to ${normalizedEmail}.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img src={nexusLogo} alt="Nexus AI" className="h-16 w-16 rounded-full" />
        </div>

        {/* Glass Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            padding: "40px",
          }}
        >
          {/* Login Tab Pill */}
          <div className="flex justify-center mb-8">
            <div
              style={{
                background: "rgba(0,0,0,0.6)",
                borderRadius: "9999px",
                padding: "10px 40px",
              }}
            >
              <span className="text-white text-lg font-semibold tracking-wide">Login</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username / Email */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Username</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="w-full pr-10 pl-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                  }}
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-white/50 hover:text-white/80 transition-colors">
                Forgot password
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "9999px",
              }}
            >
              {loading ? "Signing in..." : "Login"}
            </button>

            {/* Sign up link */}
            <p className="text-center text-sm text-white/40 pt-2">
              Don't have an account?{" "}
              <Link to="/signup" className="text-white/70 hover:text-white transition-colors font-medium">
                Register
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
