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

type SyncTarget = {
  insight_type: "ops_insights" | "staff_metrics" | "client_predictions";
  storage_kind: "outputs/admin" | "outputs/admin_staff" | "outputs/client";
  filename: string;
};

const TARGETS: SyncTarget[] = [
  { insight_type: "ops_insights", storage_kind: "outputs/admin", filename: "ops_insights.json" },
  { insight_type: "staff_metrics", storage_kind: "outputs/admin_staff", filename: "staff_metrics.json" },
  { insight_type: "client_predictions", storage_kind: "outputs/client", filename: "best_time_to_visit.json" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuth(req);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bucket = "analytics-data";

    // Get all orgs
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("is_active", true);

    if (orgsError) throw orgsError;

    const results: Record<string, { synced: string[]; skipped: string[]; errors: string[] }> = {};

    for (const org of organizations || []) {
      results[org.id] = { synced: [], skipped: [], errors: [] };

      for (const t of TARGETS) {
        const path = `analytics/${org.id}/${t.storage_kind}/${t.filename}`;

        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(path);

          if (downloadError || !fileData) {
            results[org.id].skipped.push(`${t.insight_type}:missing`);
            continue;
          }

          const content = await fileData.text();
          const outputData = JSON.parse(content);

          const newGeneratedAt = outputData.generated_at || outputData.meta?.generated_at || null;

          const { data: existing } = await supabase
            .from("analytics_insights")
            .select("id, generated_at")
            .eq("organization_id", org.id)
            .eq("insight_type", t.insight_type)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing && newGeneratedAt && existing.generated_at === newGeneratedAt) {
            results[org.id].skipped.push(`${t.insight_type}:up_to_date`);
            continue;
          }

          // expire old
          await supabase
            .from("analytics_insights")
            .update({ expires_at: new Date().toISOString() })
            .eq("organization_id", org.id)
            .eq("insight_type", t.insight_type)
            .is("expires_at", null);

          const periodStart =
            outputData.period?.start ||
            outputData.period_start ||
            outputData.meta?.period_start ||
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

          const periodEnd =
            outputData.period?.end ||
            outputData.period_end ||
            outputData.meta?.period_end ||
            new Date().toISOString().split("T")[0];

          const { error: insertError } = await supabase
            .from("analytics_insights")
            .insert({
              organization_id: org.id,
              insight_type: t.insight_type,
              data: outputData.data || outputData,
              generated_at: newGeneratedAt || new Date().toISOString(),
              period_start: periodStart,
              period_end: periodEnd,
              notebook_version: outputData.model_info?.version || outputData.meta?.notebook_version || null,
            });

          if (insertError) throw insertError;

          results[org.id].synced.push(t.insight_type);
        } catch (err) {
          results[org.id].errors.push(`${t.insight_type}:${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
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
