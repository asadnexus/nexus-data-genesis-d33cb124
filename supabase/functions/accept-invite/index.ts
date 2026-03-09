import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { token, auth_user_id } = await req.json();

    if (!token || !auth_user_id) {
      return new Response(JSON.stringify({ error: "Missing token or auth_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up invitation by token
    const { data: invite, error: inviteError } = await adminClient
      .from("invitations")
      .select("*")
      .eq("token", token)
      .is("used_by", null)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or already used invite link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invite link has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get auth user details
    const { data: { user: authUser }, error: userError } = await adminClient.auth.admin.getUserById(auth_user_id);
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate user code
    const { data: code } = await adminClient.rpc("generate_user_code", { _role: invite.role });

    // Create profile
    const { error: profileError } = await adminClient.from("users").insert({
      auth_id: auth_user_id,
      user_code: code,
      email: authUser.email,
      name: authUser.user_metadata?.name || authUser.email,
      phone: authUser.user_metadata?.phone || null,
      created_by: invite.created_by,
    });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: auth_user_id,
      role: invite.role,
    });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invitation as used
    await adminClient
      .from("invitations")
      .update({ used_by: auth_user_id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, role: invite.role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
