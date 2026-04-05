import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_MAP: Record<string, string> = {
  in_review: "In Review",
  pending: "Individual · Order",
  delivered: "Delivered",
  delivered_approval_pending: "Delivered Approved",
  cancelled: "Cancelled",
  cancelled_approval_pending: "Cancelled",
  hold: "On Hold",
  partial_delivered: "Delivered",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional auth check for manual trigger
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { error: userError } = await supabase.auth.getUser(token);
      if (userError) throw new Error("Not authenticated");
    }

    // Get orders that need syncing
    const excludedStatuses = ["Delivered", "Delivered Approved", "Cancelled", "Returned", "New Order"];
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, consignment_id, courier_name, organization_id, status, note")
      .not("consignment_id", "is", null)
      .is("deleted_at", null);

    if (ordersError) throw ordersError;

    const syncableOrders = (orders || []).filter(
      (o) => o.consignment_id && !excludedStatuses.includes(o.status || "")
    );

    if (!syncableOrders.length) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: "No orders to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group orders by organization to use correct courier keys
    const orgGroups: Record<string, typeof syncableOrders> = {};
    for (const order of syncableOrders) {
      const orgId = order.organization_id || "none";
      if (!orgGroups[orgId]) orgGroups[orgId] = [];
      orgGroups[orgId].push(order);
    }

    let totalUpdated = 0;

    for (const [orgId, orgOrders] of Object.entries(orgGroups)) {
      // Get courier keys for this org
      const { data: courierData } = await supabase
        .from("couriers")
        .select("api_key, secret_key, name")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!courierData) continue;

      for (const order of orgOrders) {
        try {
          const response = await fetch(
            `https://portal.packzy.com/api/v1/status_by_cid/${order.consignment_id}`,
            {
              method: "GET",
              headers: {
                "Api-Key": courierData.api_key,
                "Secret-Key": courierData.secret_key,
                "Content-Type": "application/json",
              },
            }
          );

          const data = await response.json();

          if (data.status === 200 && data.delivery_status) {
            const apiStatus = data.delivery_status;
            const mappedStatus = STATUS_MAP[apiStatus];

            if (mappedStatus && mappedStatus !== order.status) {
              const updateData: Record<string, unknown> = { status: mappedStatus };

              // Add note for partial delivery
              if (apiStatus === "partial_delivered") {
                updateData.note = order.note
                  ? `${order.note} | Partial Delivery`
                  : "Partial Delivery";
              }

              await supabase.from("orders").update(updateData).eq("id", order.id);
              totalUpdated++;
            }
          }
        } catch (err) {
          console.error(`Failed to sync order ${order.id}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated: totalUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
