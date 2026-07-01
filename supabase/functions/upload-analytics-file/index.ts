import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { corsHeaders, requireEdgeSecret, requireEnv } from "../_shared/edgeAuth.ts";

function requireAuth(req: Request) {
  requireEdgeSecret(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuth(req);

    const { organization_id, kind, filename, content_base64, content_type } =
      await req.json();

    if (!organization_id || !kind || !filename || !content_base64) {
      return new Response(JSON.stringify({
        error: "organization_id, kind, filename, content_base64 required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const bucket = "analytics-data";
    const path = `analytics/${organization_id}/${kind}/${filename}`;

    const bytes = Uint8Array.from(atob(content_base64), (c) => c.charCodeAt(0));

    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      upsert: true,
      contentType: content_type || "application/json; charset=utf-8",
      cacheControl: "0",
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.includes("Unauthorized") ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
