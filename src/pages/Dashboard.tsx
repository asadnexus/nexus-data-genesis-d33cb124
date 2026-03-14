import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { Link, useLocation } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from "recharts";
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, Truck, UserCog, Settings,
  Globe, ArrowLeftRight, Archive, BarChart3, Lock, Bell, Eye,
} from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.png";

/* ───── nav links ───── */
const topLinks = [
  { label: "Home", to: "/dashboard" },
  { label: "Finances", to: "/orders" },
  { label: "Products", to: "/products" },
  { label: "Orders", to: "/orders" },
  { label: "Admin panel", to: "/settings" },
];

const activeSideItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Orders", icon: ShoppingCart, to: "/orders" },
  { label: "Products", icon: Package, to: "/products" },
  { label: "Customers", icon: Users, to: "/customers" },
  { label: "Invoice", icon: FileText, to: "/invoice-settings" },
  { label: "Courier\nManagement", icon: Truck, to: "/settings" },
  { label: "Users", icon: UserCog, to: "/users" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const lockedSideItems = [
  { label: "Website\nManagement", icon: Globe },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Inventory", icon: Archive },
  { label: "Analytics", icon: BarChart3 },
];

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#3b82f6",
  Pending: "#8b5cf6",
  Sending: "#6366f1",
  Cancelled: "#64748b",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Delivered: { bg: "rgba(0,176,116,0.15)", text: "#00B074" },
  Pending: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  Sending: { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  Cancelled: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
};

const fmt = (n: number) => `৳${n.toLocaleString("en-BD")}`;

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();
  const location = useLocation();

  const totalOrders = useAnimatedNumber(stats?.totalOrders ?? 0);
  const totalCOD = useAnimatedNumber(stats?.totalCOD ?? 0);
  const totalDue = useAnimatedNumber(stats?.totalDue ?? 0);

  const ordersByStatus = stats?.ordersByStatus ?? [];
  const totalForPercent = ordersByStatus.reduce((s, e) => s + e.count, 0) || 1;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#0a1628" }}>
      {/* ─── TOP NAVBAR ─── */}
      <header className="flex items-center justify-center py-3 px-6 z-50" style={{ minHeight: 56 }}>
        <nav
          className="flex items-center gap-1 rounded-full px-2 py-1.5"
          style={{
            background: "#0d1b2e",
            border: "1px solid rgba(99,220,255,0.25)",
          }}
        >
          {topLinks.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.label}
                to={l.to}
                className="px-5 py-2 rounded-full text-sm font-medium transition-all"
                style={
                  active
                    ? {
                        background: "rgba(0,176,116,0.15)",
                        border: "1px solid #00B074",
                        boxShadow: "0 0 12px rgba(0,176,116,0.2)",
                        color: "#00B074",
                      }
                    : { color: "rgba(255,255,255,0.6)", border: "1px solid transparent" }
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute right-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {profile?.name?.[0] ?? "U"}
          </div>
          <Bell className="w-5 h-5 text-white/50" />
        </div>
      </header>

      {/* ─── BODY ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── SIDEBAR ─── */}
        <aside
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{ width: 210, background: "#0d1b2e", borderRight: "1px solid rgba(99,220,255,0.1)" }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center pt-4 pb-2">
            <img src={nexusLogo} alt="Nexus AI" className="w-28 h-28 object-contain" />
            <span className="text-white/90 text-sm font-semibold mt-1">Nexus AI™</span>
          </div>

          {/* Active nav items */}
          <nav className="flex-1 px-3 space-y-0.5">
            {activeSideItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={
                    active
                      ? { background: "rgba(99,220,255,0.08)", color: "#63dcff" }
                      : { color: "rgba(255,255,255,0.6)" }
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-pre-line leading-tight">{item.label}</span>
                </Link>
              );
            })}

            {/* Locked items */}
            <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {lockedSideItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-not-allowed group relative"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  title="Paid plan"
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-pre-line leading-tight flex-1">{item.label}</span>
                  <Lock className="w-3 h-3 shrink-0" />
                  <span className="absolute left-full ml-2 px-2 py-1 rounded text-xs bg-black/90 text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Paid plan
                  </span>
                </div>
              ))}
            </div>
          </nav>

          {/* User info bottom */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm text-white/80 font-medium truncate">{profile?.name ?? "User"}</p>
            <p className="text-xs font-medium" style={{ color: "#00B074" }}>
              {role === "main_admin" ? "Main Admin" : role?.replace("_", " ") ?? ""}
            </p>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
          {/* Row 1: KPI cards — 2x2 grid left, chart right */}
          <div className="flex gap-3" style={{ minHeight: 0 }}>
            {/* Left: 2x2 KPI grid */}
            <div className="grid grid-cols-2 gap-3" style={{ flex: "0 0 55%" }}>
              {[
                { label: "Total Sales Orders", value: isLoading ? "—" : totalOrders.toLocaleString() },
                { label: "Confirmed Gross Revenue", value: isLoading ? "—" : fmt(totalCOD) },
                { label: "Outstanding Receivables", value: isLoading ? "—" : fmt(totalDue) },
                { label: "COD Cash Received", value: isLoading ? "—" : fmt(stats?.totalCOD ?? 0) },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl px-4 py-3 animate-count-up"
                  style={{
                    background: "#111d30",
                    border: "1px solid rgba(99,220,255,0.1)",
                  }}
                >
                  <p className="text-xs text-white/50 mb-1">{c.label}</p>
                  <p className="text-xl font-bold text-white">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Right: Sales Performance chart */}
            <div
              className="flex-1 rounded-xl p-4 flex flex-col"
              style={{ background: "#111d30", border: "1px solid rgba(99,220,255,0.1)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-white">Sales Performance</p>
                <div className="flex gap-1 text-xs">
                  <button className="px-3 py-1 rounded-full bg-white/10 text-white/70">Weekly</button>
                  <button className="px-3 py-1 rounded-full text-white/40">Monthly</button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.recentOrders ?? []}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a2a40", border: "1px solid rgba(99,220,255,0.2)", borderRadius: 8, color: "#fff" }} />
                    <Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} fill="url(#salesGrad)" dot={{ r: 3, fill: "#f97316" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Recent Orders table left, Status Overview right */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Left: Recent Orders */}
            <div
              className="rounded-xl p-4 flex flex-col"
              style={{ flex: "0 0 55%", background: "#111d30", border: "1px solid rgba(99,220,255,0.1)" }}
            >
              <p className="text-sm font-semibold text-white mb-2">Recent Orders</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 border-b border-white/5">
                    <th className="text-left py-1.5 font-medium">Order id</th>
                    <th className="text-left py-1.5 font-medium">Name</th>
                    <th className="text-left py-1.5 font-medium">Number</th>
                    <th className="text-left py-1.5 font-medium">Status</th>
                    <th className="text-center py-1.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentOrderRows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-white/30">No orders yet</td>
                    </tr>
                  ) : (
                    stats!.recentOrderRows.slice(0, 4).map((o, i) => {
                      const badge = STATUS_BADGE[o.status ?? "Pending"] ?? STATUS_BADGE.Pending;
                      const phone = o.customer_phone?.startsWith("+880")
                        ? o.customer_phone
                        : `+880 ${o.customer_phone?.replace(/^0/, "").slice(0, 2)}...`;
                      return (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 text-cyan-400">#{o.invoice_code}</td>
                          <td className="py-1.5 text-white/80">{o.customer_name}</td>
                          <td className="py-1.5 text-white/60">{phone}</td>
                          <td className="py-1.5">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              {o.status ?? "Pending"}
                            </span>
                          </td>
                          <td className="py-1.5 text-center">
                            <Link
                              to="/orders"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ background: "rgba(0,176,116,0.15)", color: "#00B074", border: "1px solid rgba(0,176,116,0.3)" }}
                            >
                              <Eye className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: Order Status Overview */}
            <div
              className="flex-1 rounded-xl p-4 flex flex-col"
              style={{ background: "#111d30", border: "1px solid rgba(99,220,255,0.1)" }}
            >
              <p className="text-sm font-semibold text-white mb-3">Order Status Overview</p>
              <div className="space-y-4 flex-1">
                {["Delivered", "Pending", "Sending", "Cancelled"].map((st) => {
                  const entry = ordersByStatus.find(e => e.status === st);
                  const count = entry?.count ?? 0;
                  const pct = Math.round((count / totalForPercent) * 100);
                  return (
                    <div key={st}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white/70">{st}</span>
                        <span className="text-white/50">{pct}% ({count})</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: STATUS_COLORS[st] ?? "#64748b" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
