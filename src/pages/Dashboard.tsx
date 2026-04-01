import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ShoppingCart, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
} from "recharts";

const formatCurrency = (v: number) => `৳${v.toLocaleString("en-BD")}`;

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#22c55e",
  Pending: "#eab308",
  Sending: "#3b82f6",
  Dispatched: "#3b82f6",
  Cancelled: "#ef4444",
};

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "16px",
};

type ChartMode = "Sales Performance" | "Order Performance";
type TimeRange = "12 Months" | "6 Months" | "3 Months" | "1 Month";
const RANGE_MAP: Record<TimeRange, number> = { "12 Months": 12, "6 Months": 6, "3 Months": 3, "1 Month": 1 };

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();
  const navigate = useNavigate();

  const [chartMode, setChartMode] = useState<ChartMode>("Sales Performance");
  const [chartDropOpen, setChartDropOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("12 Months");
  const [timeDropOpen, setTimeDropOpen] = useState(false);
  const [activeModalOpen, setActiveModalOpen] = useState(false);

  const chartData = useMemo(() => {
    if (!stats) return [];
    const src = chartMode === "Sales Performance" ? stats.monthlySales : stats.monthlyOrders;
    const count = RANGE_MAP[timeRange];
    return src.slice(-count);
  }, [stats, chartMode, timeRange]);

  const donutData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Delivered", value: stats.deliveredCount, color: "#22c55e" },
      { name: "Pending", value: stats.pendingCount, color: "#eab308" },
      { name: "Sending", value: stats.sendingCount, color: "#3b82f6" },
      { name: "Cancelled", value: stats.cancelledCount, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [stats]);

  const totalStatusCount = donutData.reduce((s, d) => s + d.value, 0);

  const kpis = [
    { label: "Total Sales Data", value: formatCurrency(stats?.totalSales ?? 0), change: stats?.salesChange ?? 0 },
    { label: "Confirm Gross Performance", value: `${(stats?.successRate ?? 0).toFixed(1)}%`, change: stats?.successChange ?? 0 },
    { label: "Success Orders", value: (stats?.deliveredCount ?? 0).toLocaleString(), change: stats?.ordersChange ?? 0 },
    { label: "COD Cash Received", value: formatCurrency(stats?.totalCOD ?? 0), change: stats?.codChange ?? 0 },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[55%_45%] p-2">
        <Skeleton className="h-[500px] rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white/90 tracking-wide uppercase">Merchant Dashboard</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[55%_45%]">
        {/* LEFT: Sales Performance Chart */}
        <div style={glassCard} className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            {/* Chart mode dropdown */}
            <div className="relative">
              <button
                onClick={() => setChartDropOpen(!chartDropOpen)}
                className="flex items-center gap-2 text-lg font-semibold text-white"
              >
                {chartMode} <ChevronDown className="h-4 w-4" />
              </button>
              {chartDropOpen && (
                <div
                  className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
                  style={{ ...glassCard, minWidth: 200 }}
                >
                  {(["Sales Performance", "Order Performance"] as ChartMode[]).map(m => (
                    <button
                      key={m}
                      className={`block w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 ${m === chartMode ? "bg-white/10" : ""}`}
                      onClick={() => { setChartMode(m); setChartDropOpen(false); }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time range dropdown */}
            <div className="relative">
              <button
                onClick={() => setTimeDropOpen(!timeDropOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {timeRange} <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {timeDropOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
                  style={{ ...glassCard, minWidth: 140 }}
                >
                  {(["12 Months", "6 Months", "3 Months", "1 Month"] as TimeRange[]).map(t => (
                    <button
                      key={t}
                      className={`block w-full text-left px-4 py-2 text-sm text-white/90 hover:bg-white/10 ${t === timeRange ? "bg-white/10" : ""}`}
                      onClick={() => { setTimeRange(t); setTimeDropOpen(false); }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#fff" }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Active Orders Card */}
          <div style={glassCard} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs text-green-400 font-medium uppercase tracking-wider">Active</div>
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart className="h-4 w-4 text-white/60" />
                <span className="font-medium">Orders</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-white">{stats?.activeOrdersCount ?? 0}</span>
              <button onClick={() => setActiveModalOpen(true)}>
                <ChevronDown className="h-5 w-5 text-white/60 hover:text-white transition-colors" />
              </button>
            </div>
          </div>

          {/* KPI Cards 2x2 */}
          <div className="grid grid-cols-2 gap-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: "16px",
                }}
                className="p-4"
              >
                <p className="text-xs text-white/60 mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p className={`text-xs mt-1 ${kpi.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {kpi.change >= 0 ? "+" : ""}{kpi.change.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>

          {/* Order Status Donut */}
          <div style={glassCard} className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Order Status Overview</h3>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-white/80">{d.name}</span>
                    <span className="text-white font-medium ml-auto">{d.value.toLocaleString()}</span>
                    <span className="text-white/50 text-xs">({totalStatusCount > 0 ? ((d.value / totalStatusCount) * 100).toFixed(0) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Orders Modal */}
      {activeModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: "rgba(0,0,0,0.6)" }}
          onClick={() => setActiveModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...glassCard, width: "90%", maxWidth: 480 }}
            className="p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Active Orders</h2>
              <button onClick={() => setActiveModalOpen(false)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {(stats?.activeOrders ?? []).map(o => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <div>
                    <span className="text-sm font-medium text-white">{o.invoice_code}</span>
                    <span className="text-xs text-white/50 ml-2">{o.customer_name}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${STATUS_COLORS[o.status] || "#666"}20`,
                      color: STATUS_COLORS[o.status] || "#999",
                    }}
                  >
                    {o.status}
                  </span>
                </div>
              ))}
              {(stats?.activeOrders ?? []).length === 0 && (
                <p className="text-center text-white/40 py-4 text-sm">No active orders</p>
              )}
            </div>
            <button
              className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => { setActiveModalOpen(false); navigate("/orders"); }}
            >
              See more →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
