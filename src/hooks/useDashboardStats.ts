import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface DashboardStats {
  totalOrders: number;
  totalSales: number;
  totalDue: number;
  totalAdvance: number;
  totalCOD: number;
  activeOrdersCount: number;
  deliveredCount: number;
  pendingCount: number;
  sendingCount: number;
  cancelledCount: number;
  successRate: number;
  salesChange: number;
  successChange: number;
  codChange: number;
  ordersChange: number;
  monthlySales: { month: string; value: number }[];
  monthlyOrders: { month: string; value: number }[];
  activeOrders: { id: string; invoice_code: string; customer_name: string; status: string }[];
}

export function useDashboardStats() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_value, total_due, advance, cod, status, created_at, invoice_code, customer_name")
        .is("deleted_at", null);

      const all = orders || [];
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
      const lastMonth = lastMonthDate.getMonth();
      const lastYear = lastMonthDate.getFullYear();

      const isThisMonth = (d: string) => {
        const dt = new Date(d);
        return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear;
      };
      const isLastMonth = (d: string) => {
        const dt = new Date(d);
        return dt.getMonth() === lastMonth && dt.getFullYear() === lastYear;
      };

      const thisMonthOrders = all.filter(o => isThisMonth(o.created_at));
      const lastMonthOrders = all.filter(o => isLastMonth(o.created_at));

      const totalSales = all.reduce((s, o) => s + (Number(o.order_value) || 0), 0);
      const totalCOD = all.reduce((s, o) => s + (Number(o.cod) || 0), 0);
      const deliveredCount = all.filter(o => o.status === "Delivered" || o.status === "Delivered Approved").length;
      const pendingCount = all.filter(o => o.status === "New Order" || o.status === "Pending" || o.status === "Individual · Order" || o.status === "Bulk Sent · Pending").length;
      const sendingCount = all.filter(o => o.status === "Dispatched" || o.status === "In Review").length;
      const cancelledCount = all.filter(o => o.status === "Cancelled").length;
      const successRate = all.length > 0 ? (deliveredCount / all.length) * 100 : 0;

      const activeOrdersCount = all.filter(o => ["New Order", "Pending", "Individual · Order", "Bulk Sent · Pending", "Dispatched", "In Review"].includes(o.status || "")).length;

      // % changes
      const tmSales = thisMonthOrders.reduce((s, o) => s + (Number(o.order_value) || 0), 0);
      const lmSales = lastMonthOrders.reduce((s, o) => s + (Number(o.order_value) || 0), 0);
      const salesChange = lmSales > 0 ? ((tmSales - lmSales) / lmSales) * 100 : 0;

      const tmDelivered = thisMonthOrders.filter(o => o.status === "Delivered" || o.status === "Delivered Approved").length;
      const lmDelivered = lastMonthOrders.filter(o => o.status === "Delivered" || o.status === "Delivered Approved").length;
      const tmRate = thisMonthOrders.length > 0 ? (tmDelivered / thisMonthOrders.length) * 100 : 0;
      const lmRate = lastMonthOrders.length > 0 ? (lmDelivered / lastMonthOrders.length) * 100 : 0;
      const successChange = lmRate > 0 ? tmRate - lmRate : 0;

      const tmCOD = thisMonthOrders.reduce((s, o) => s + (Number(o.cod) || 0), 0);
      const lmCOD = lastMonthOrders.reduce((s, o) => s + (Number(o.cod) || 0), 0);
      const codChange = lmCOD > 0 ? ((tmCOD - lmCOD) / lmCOD) * 100 : 0;

      const ordersChange = lastMonthOrders.length > 0 ? ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100 : 0;

      // Monthly aggregation (last 12 months)
      const monthlySales: { month: string; value: number }[] = [];
      const monthlyOrders: { month: string; value: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(thisYear, thisMonth - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        const label = d.toLocaleDateString("en-US", { month: "short" });
        const monthOrders = all.filter(o => {
          const dt = new Date(o.created_at);
          return dt.getMonth() === m && dt.getFullYear() === y;
        });
        monthlySales.push({ month: label, value: monthOrders.reduce((s, o) => s + (Number(o.cod) || 0), 0) });
        monthlyOrders.push({ month: label, value: monthOrders.length });
      }

      // Active orders (recent 7)
      const activeOrders = all
        .filter(o => o.status === "Pending" || o.status === "Sending" || o.status === "Dispatched")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 7)
        .map(o => ({ id: o.id, invoice_code: o.invoice_code, customer_name: o.customer_name, status: o.status || "Pending" }));

      return {
        totalOrders: all.length,
        totalSales,
        totalDue: all.reduce((s, o) => s + (Number(o.total_due) || 0), 0),
        totalAdvance: all.reduce((s, o) => s + (Number(o.advance) || 0), 0),
        totalCOD,
        activeOrdersCount,
        deliveredCount,
        pendingCount,
        sendingCount,
        cancelledCount,
        successRate,
        salesChange,
        successChange,
        codChange,
        ordersChange,
        monthlySales,
        monthlyOrders,
        activeOrders,
      };
    },
    refetchInterval: 30000,
  });
}
