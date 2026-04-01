import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/usePermissions";
import { Package, Users, UserCog, LayoutDashboard, LogOut, Menu, X, ShoppingCart, Settings, FileText, Truck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/hooks/usePermissions";
import nexusLogo from "@/assets/nexus-logo.png";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  permissionKey?: PermissionKey;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_dashboard" },
  { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_orders" },
  { to: "/customers", label: "Customers", icon: Users, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_customers" },
  { to: "/products", label: "Products", icon: Package, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_products" },
  { to: "/users", label: "Admin Panel", icon: UserCog, roles: ["main_admin"] },
];

const sidebarItems: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Settings, roles: ["main_admin", "sub_admin", "moderator"], permissionKey: "can_view_settings" },
  { to: "/invoice-settings", label: "Invoice", icon: FileText, roles: ["main_admin", "sub_admin"] },
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

  const filteredSidebar = sidebarItems.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (item.permissionKey && !permissions[item.permissionKey]) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar icons */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[56px] z-50 flex-col items-center py-4 gap-3"
        style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {filteredSidebar.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isActive ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/8")
            }
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}
        <div className="mt-auto">
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/8 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-[56px]">
        {/* Top navbar */}
        <header className="sticky top-0 z-40 flex items-center gap-2 px-4 lg:px-6 h-14"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="lg:hidden text-white/70" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-2 mr-4">
            <img src={nexusLogo} alt="Nexus" className="h-8 w-8 rounded-full object-cover" />
          </NavLink>

          {/* Pill nav */}
          <nav className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: "rgba(13,27,46,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {filteredNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all",
                    isActive ? "bg-white/12 text-white" : "text-white/55 hover:text-white/80")
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 hidden sm:block">{profile?.name}</span>
            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
              {profile?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>
        </header>

        {/* Mobile dropdown */}
        {sidebarOpen && (
          <div className="lg:hidden absolute top-14 left-0 right-0 z-50 p-3"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)" }}>
            {[...filteredNav, ...filteredSidebar].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                    isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white")
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 w-full">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
