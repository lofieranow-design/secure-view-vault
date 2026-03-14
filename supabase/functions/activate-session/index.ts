import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, message: "Code required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the code
    const { data: codeData, error } = await supabase
      .from("access_codes")
      .select("*")
      .eq("code", code)
      .eq("status", "active")
      .maybeSingle();

    if (error || !codeData) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid or inactive code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already activated
    if (codeData.activated_at) {
      const expiresAt = new Date(codeData.expires_at).getTime();
      if (Date.now() > expiresAt) {
        await supabase.from("access_codes").update({ status: "expired" }).eq("id", codeData.id);
        return new Response(
          JSON.stringify({ success: false, message: "Access has expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Return existing session
      const { data: session } = await supabase
        .from("viewer_sessions")
        .select("session_token")
        .eq("code_id", codeData.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ success: true, sessionToken: session?.session_token || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Activate: set timestamps
    const now = new Date();
    const expiresAt = new Date(now.getTime() + codeData.timer_duration * 60 * 1000);

    await supabase
      .from("access_codes")
      .update({ activated_at: now.toISOString(), expires_at: expiresAt.toISOString() })
      .eq("id", codeData.id);

    // Create session
    const sessionToken = crypto.randomUUID();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    await supabase.from("viewer_sessions").insert({
      code_id: codeData.id,
      session_token: sessionToken,
      session_expiry: expiresAt.toISOString(),
      ip_address: ip,
      user_agent: ua,
    });

    // Log activation
    await supabase.from("activity_log").insert({
      event_type: "session_activated",
      code_id: codeData.id,
      ip_address: ip,
      details: { expires_at: expiresAt.toISOString() },
    });

    return new Response(
      JSON.stringify({ success: true, sessionToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
