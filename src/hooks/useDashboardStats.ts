import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalTeam: number;
  totalOrders: number;
  totalSales: number;
  totalDue: number;
  totalAdvance: number;
  totalCOD: number;
  recentOrders: {
    date: string;
    orders: number;
    sales: number;
  }[];
  ordersByStatus: {
    status: string;
    count: number;
  }[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const [
        productsResult,
        customersResult,
        teamResult,
        ordersResult,
      ] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("orders").select("id, order_value, total_due, advance, cod, status, created_at").is("deleted_at", null),
      ]);

      const orders = ordersResult.data || [];
      
      // Calculate totals
      const totalSales = orders.reduce((sum, o) => sum + (Number(o.order_value) || 0), 0);
      const totalDue = orders.reduce((sum, o) => sum + (Number(o.total_due) || 0), 0);
      const totalAdvance = orders.reduce((sum, o) => sum + (Number(o.advance) || 0), 0);
      const totalCOD = orders.reduce((sum, o) => sum + (Number(o.cod) || 0), 0);

      // Group orders by date (last 7 days)
      const last7Days: { date: string; orders: number; sales: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr));
        last7Days.push({
          date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          orders: dayOrders.length,
          sales: dayOrders.reduce((sum, o) => sum + (Number(o.order_value) || 0), 0),
        });
      }

      // Group by status
      const statusCounts: Record<string, number> = {};
      orders.forEach(o => {
        const status = o.status || "Pending";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

      return {
        totalProducts: productsResult.count || 0,
        totalCustomers: customersResult.count || 0,
        totalTeam: teamResult.count || 0,
        totalOrders: orders.length,
        totalSales,
        totalDue,
        totalAdvance,
        totalCOD,
        recentOrders: last7Days,
        ordersByStatus,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
