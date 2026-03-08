import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Users, UserCog, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["main_admin", "sub_admin", "moderator"] },
  { to: "/products", label: "Products", icon: Package, roles: ["main_admin", "sub_admin", "moderator"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["main_admin", "sub_admin", "moderator"] },
  { to: "/users", label: "Users", icon: UserCog, roles: ["main_admin"] },
];

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNav = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-6">
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="text-sm font-bold text-secondary-foreground">N</span>
          </div>
          <span className="text-lg font-bold text-[hsl(var(--sidebar-foreground))]">Nexus AI</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden text-[hsl(var(--sidebar-foreground))]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                    : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-[hsl(var(--sidebar-foreground))]">{profile?.name}</p>
            <p className="text-xs text-[hsl(var(--sidebar-foreground)/.6)]">
              {profile?.user_code} · {role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-background px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">{profile?.email}</span>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
