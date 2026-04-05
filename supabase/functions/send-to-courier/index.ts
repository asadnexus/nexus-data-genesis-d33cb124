import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Not authenticated");

    const body = await req.json();
    const { courier_id, orders } = body;

    if (!courier_id || !orders?.length) throw new Error("Missing courier_id or orders");

    // Get courier config
    const { data: courier, error: cError } = await supabase
      .from("couriers")
      .select("*")
      .eq("id", courier_id)
      .single();
    if (cError || !courier) throw new Error("Courier not found");

    const baseUrl = courier.name.toLowerCase().includes("steadfast")
      ? "https://portal.packzy.com/api/v1"
      : courier.base_url;

    const isBulk = orders.length > 1;

    const results: Array<{ order_id: string; success: boolean; tracking_code?: string; consignment_id?: string; error?: string }> = [];

    for (const order of orders) {
      try {
        const response = await fetch(`${baseUrl}/create_order`, {
          method: "POST",
          headers: {
            "Api-Key": courier.api_key,
            "Secret-Key": courier.secret_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoice: order.invoice,
            recipient_name: order.recipient_name,
            recipient_phone: order.recipient_phone,
            recipient_address: order.recipient_address || "",
            cod_amount: order.cod_amount,
            note: order.note || "",
          }),
        });

        const data = await response.json();

        if (data.status === 200 && data.consignment) {
          const trackingCode = data.consignment.tracking_code;
          const consignmentId = String(data.consignment.consignment_id || "");
          const newStatus = isBulk ? "Bulk Sent · Pending" : "Individual · Order";

          await supabase
            .from("orders")
            .update({
              status: newStatus,
              tracking_code: trackingCode,
              consignment_id: consignmentId,
              courier_id: courier_id,
              courier_name: courier.name,
            })
            .eq("id", order.order_id);

          results.push({ order_id: order.order_id, success: true, tracking_code: trackingCode, consignment_id: consignmentId });
        } else {
          results.push({
            order_id: order.order_id,
            success: false,
            error: data.message || data.errors || "Unknown API error",
          });
        }
      } catch (err) {
        results.push({
          order_id: order.order_id,
          success: false,
          error: err.message || "Network error",
        });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
