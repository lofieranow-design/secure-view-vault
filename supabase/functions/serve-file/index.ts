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
    const { fileId, sessionToken } = await req.json();
    if (!fileId || !sessionToken) {
      return new Response(
        JSON.stringify({ error: "fileId and sessionToken required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session
    const { data: session } = await supabase
      .from("viewer_sessions")
      .select("id, code_id, session_expiry, is_active")
      .eq("session_token", sessionToken)
      .eq("is_active", true)
      .maybeSingle();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (new Date(session.session_expiry) < new Date()) {
      await supabase.from("viewer_sessions").update({ is_active: false }).eq("id", session.id);
      await supabase.from("access_codes").update({ status: "expired" }).eq("id", session.code_id);
      return new Response(
        JSON.stringify({ error: "Session has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check file is linked to this session's code
    const { data: mapping } = await supabase
      .from("code_file_mappings")
      .select("id")
      .eq("code_id", session.code_id)
      .eq("file_id", fileId)
      .maybeSingle();

    if (!mapping) {
      return new Response(
        JSON.stringify({ error: "File not authorized for this code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get file info
    const { data: fileData } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .maybeSingle();

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Create a short-lived signed URL (60 seconds)
    const { data: signedData, error: signError } = await supabase.storage
      .from("digital-products")
      .createSignedUrl(fileData.storage_path, 60);

    if (signError || !signedData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate file access" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Log file access
    await supabase.from("activity_log").insert({
      event_type: "file_accessed",
      code_id: session.code_id,
      session_id: session.id,
      details: { file_id: fileId, filename: fileData.filename },
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
    });

    return new Response(
      JSON.stringify({
        signedUrl: signedData.signedUrl,
        contentType: fileData.filetype,
        filename: fileData.filename,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
