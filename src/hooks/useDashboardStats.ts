import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RecentOrderRow {
  invoice_code: string;
  customer_name: string;
  customer_phone: string;
  cod: number | null;
  status: string | null;
}

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalTeam: number;
  totalOrders: number;
  totalSales: number;
  totalDue: number;
  totalAdvance: number;
  totalCOD: number;
  totalDelivered: number;
  recentOrders: {
    date: string;
    orders: number;
    sales: number;
  }[];
  ordersByStatus: {
    status: string;
    count: number;
  }[];
  recentOrderRows: RecentOrderRow[];
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
      const totalDelivered = orders.filter(o => o.status === "Delivered").length;

      // Recent order rows (last 5)
      const recentOrderRows: RecentOrderRow[] = orders
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map(o => ({
          invoice_code: (o as any).invoice_code || "",
          customer_name: (o as any).customer_name || "",
          customer_phone: (o as any).customer_phone || "",
          cod: o.cod,
          status: o.status,
        }));

      // Group orders by date (last 7 days)
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
