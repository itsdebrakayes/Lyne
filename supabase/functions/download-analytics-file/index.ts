import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function requireAuth(req: Request) {
  const expected = requireEnv("EDGE_SYNC_SECRET");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token || token !== expected) throw new Error("Unauthorized");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuth(req);

    const { organization_id, kind, filename } = await req.json();
    if (!organization_id || !kind || !filename) {
      return new Response(JSON.stringify({ error: "organization_id, kind, filename required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const bucket = "analytics-data";
    const path = `analytics/${organization_id}/${kind}/${filename}`;

    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw error;

    const contentType = filename.endsWith(".csv")
      ? "text/csv; charset=utf-8"
      : "application/json; charset=utf-8";

    return new Response(data, {
      headers: { ...corsHeaders, "Content-Type": contentType },
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
