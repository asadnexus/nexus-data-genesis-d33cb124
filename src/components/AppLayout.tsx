import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/usePermissions";
import { Package, Users, UserCog, LayoutDashboard, LogOut, Menu, X, ShoppingCart, Settings, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/hooks/usePermissions";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  permissionKey?: PermissionKey;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_dashboard" },
  { to: "/products", label: "Products", icon: Package, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_products" },
  { to: "/customers", label: "Customers", icon: Users, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_customers" },
  { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_orders" },
  { to: "/invoice-settings", label: "Invoice", icon: FileText, roles: ["main_admin", "sub_admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_settings" },
  { to: "/users", label: "Users", icon: UserCog, roles: ["main_admin"] },
];

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const { permissions } = useMyPermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNav = navItems.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (item.permissionKey && !permissions[item.permissionKey]) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-nexus-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-nexus-primary border-r border-nexus-border transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
          <div className="h-8 w-8 rounded-lg bg-nexus-accent flex items-center justify-center">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="text-lg font-bold text-white">Nexus AI</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden text-white"
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
                    ? "bg-nexus-accent/20 text-nexus-accent-light"
                    : "text-white/60 hover:bg-nexus-primary-light hover:text-white"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-white">{profile?.name}</p>
            <p className="text-xs text-white/50">
              {profile?.user_code} · {role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-white/60 hover:bg-nexus-primary-light hover:text-white"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-nexus-border bg-nexus-card px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-nexus-text-secondary">{profile?.email}</span>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
