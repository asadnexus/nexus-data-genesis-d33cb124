import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, UserCog, ShoppingCart, DollarSign, CreditCard, Wallet, Banknote } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

const formatCurrency = (value: number) => `৳${value.toLocaleString("en-BD")}`;

const STATUS_COLORS: Record<string, string> = {
  Pending: "hsl(var(--warning))",
  Confirmed: "hsl(var(--primary))",
  Dispatched: "hsl(var(--accent))",
  Delivered: "hsl(var(--success))",
  Cancelled: "hsl(var(--destructive))",
  Returned: "hsl(var(--muted-foreground))",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();

  const metricCards = [
    { title: "Products", value: stats?.totalProducts, icon: Package, color: "text-blue-500" },
    { title: "Customers", value: stats?.totalCustomers, icon: Users, color: "text-green-500" },
    { title: "Team Members", value: stats?.totalTeam, icon: UserCog, color: "text-purple-500" },
    { title: "Total Orders", value: stats?.totalOrders, icon: ShoppingCart, color: "text-orange-500" },
  ];

  const financialCards = [
    { title: "Total Sales", value: stats?.totalSales, icon: DollarSign, color: "text-emerald-500" },
    { title: "Total Due", value: stats?.totalDue, icon: CreditCard, color: "text-red-500" },
    { title: "Total Advance", value: stats?.totalAdvance, icon: Wallet, color: "text-cyan-500" },
    { title: "Total COD", value: stats?.totalCOD, icon: Banknote, color: "text-amber-500" },
  ];

  const chartConfig = {
    orders: { label: "Orders", color: "hsl(var(--primary))" },
    sales: { label: "Sales", color: "hsl(var(--success))" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {profile?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          {role?.replace("_", " ")} · {profile?.user_code}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-card-foreground">{card.value?.toLocaleString() ?? "—"}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {financialCards.map((card) => (
          <Card key={card.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(card.value ?? 0)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Trend Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Sales Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={stats?.recentOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--success))" }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Orders by Day Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Orders (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats?.recentOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : stats?.ordersByStatus && stats.ordersByStatus.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-full md:w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.ordersByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="status"
                      >
                        {stats.ordersByStatus.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "hsl(var(--muted))"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {stats.ordersByStatus.map((entry) => (
                    <div key={entry.status} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] || "hsl(var(--muted))" }}
                      />
                      <span className="text-sm font-medium">{entry.status}</span>
                      <span className="text-sm text-muted-foreground">({entry.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
