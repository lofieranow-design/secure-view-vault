import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken } = await req.json();
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ success: false, message: "sessionToken required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find active session
    const { data: session } = await supabase
      .from("viewer_sessions")
      .select("id, code_id")
      .eq("session_token", sessionToken)
      .eq("is_active", true)
      .maybeSingle();

    if (!session) {
      return new Response(
        JSON.stringify({ success: false, message: "No active session found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Deactivate session
    await supabase
      .from("viewer_sessions")
      .update({ is_active: false })
      .eq("id", session.id);

    // Expire the code
    await supabase
      .from("access_codes")
      .update({ status: "expired" })
      .eq("id", session.code_id);

    // Log
    await supabase.from("activity_log").insert({
      event_type: "session_killed",
      code_id: session.code_id,
      session_id: session.id,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      details: { killed_by: "viewer" },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
