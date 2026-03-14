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
    if (!code || typeof code !== "string" || code.length < 10 || code.length > 30) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid code format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: check recent attempts from this IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "code_validation_attempt")
      .eq("ip_address", ip)
      .gte("created_at", fiveMinAgo);

    if ((count ?? 0) > 10) {
      return new Response(
        JSON.stringify({ valid: false, message: "Too many attempts. Please wait." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Log the attempt
    await supabase.from("activity_log").insert({
      event_type: "code_validation_attempt",
      ip_address: ip,
      details: { code_prefix: code.slice(0, 4) },
    });

    // Look up the code
    const { data: codeData, error: codeError } = await supabase
      .from("access_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid access code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (codeData.status !== "active") {
      return new Response(
        JSON.stringify({ valid: false, message: `Code is ${codeData.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already activated and expired
    if (codeData.activated_at && codeData.expires_at) {
      const expiresAt = new Date(codeData.expires_at).getTime();
      if (Date.now() > expiresAt) {
        await supabase.from("access_codes").update({ status: "expired" }).eq("id", codeData.id);
        return new Response(
          JSON.stringify({ valid: false, message: "Access code has expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get linked files
    const { data: mappings } = await supabase
      .from("code_file_mappings")
      .select("file_id")
      .eq("code_id", codeData.id);

    const fileIds = (mappings || []).map((m: { file_id: string }) => m.file_id);
    let files: { id: string; filename: string; filetype: string; storage_path: string; thumbnail_path: string | null }[] = [];
    if (fileIds.length > 0) {
      const { data: filesData } = await supabase
        .from("files")
        .select("id, filename, filetype, storage_path, thumbnail_path")
        .in("id", fileIds);
      files = filesData || [];
    }

    // If already activated, find session token
    let sessionToken = "";
    if (codeData.activated_at) {
      const { data: session } = await supabase
        .from("viewer_sessions")
        .select("session_token")
        .eq("code_id", codeData.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sessionToken = session?.session_token || "";
    }

    return new Response(
      JSON.stringify({ valid: true, codeData, files, sessionToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, message: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
