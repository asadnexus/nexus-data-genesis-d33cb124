import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Enums<"app_role">;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile && !profile.is_active) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole && role !== "main_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
