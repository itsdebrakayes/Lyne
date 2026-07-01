import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { corsHeaders, requireEdgeSecret, requireEnv } from "../_shared/edgeAuth.ts";

interface InsightImport {
  organization_id: string;
  insight_type: string;
  period_start?: string;
  period_end?: string;
  data: Record<string, any>;
  notebook_version?: string;
}

const VALID_INSIGHT_TYPES = [
  "peak_hours",
  "dropoff_periods",
  "best_times",
  "anomalies",
  "service_efficiency",
  "staff_metrics",
  "recommendations",
  "client_predictions",
  "ops_insights",
  "data_health",
];

function requireAuth(req: Request) {
  requireEdgeSecret(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuth(req);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InsightImport | InsightImport[] = await req.json();
    const imports = Array.isArray(body) ? body : [body];

    const results: { success: boolean; id?: string; error?: string; insight_type: string }[] = [];

    for (const insight of imports) {
      try {
        if (!insight.organization_id || !insight.insight_type || !insight.data) {
          results.push({
            success: false,
            insight_type: insight.insight_type || "unknown",
            error: "Missing required fields: organization_id, insight_type, data",
          });
          continue;
        }

        if (!VALID_INSIGHT_TYPES.includes(insight.insight_type)) {
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: `Invalid insight_type. Must be one of: ${VALID_INSIGHT_TYPES.join(", ")}`,
          });
          continue;
        }

        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("id", insight.organization_id)
          .single();

        if (orgError || !org) {
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: "Organization not found",
          });
          continue;
        }

        await supabase
          .from("analytics_insights")
          .update({ expires_at: new Date().toISOString() })
          .eq("organization_id", insight.organization_id)
          .eq("insight_type", insight.insight_type)
          .is("expires_at", null);

        const periodStart =
          insight.period_start ||
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
        const periodEnd = insight.period_end || new Date().toISOString().split("T")[0];

        const { data: newInsight, error: insertError } = await supabase
          .from("analytics_insights")
          .insert({
            organization_id: insight.organization_id,
            insight_type: insight.insight_type,
            data: insight.data,
            period_start: periodStart,
            period_end: periodEnd,
            notebook_version: insight.notebook_version || null,
            generated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: insertError.message,
          });
          continue;
        }

        results.push({
          success: true,
          insight_type: insight.insight_type,
          id: newInsight.id,
        });
      } catch (err) {
        results.push({
          success: false,
          insight_type: insight.insight_type || "unknown",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const allSuccessful = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        results,
        imported_count: results.filter((r) => r.success).length,
        failed_count: results.filter((r) => !r.success).length,
      }),
      {
        status: allSuccessful ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.includes("Unauthorized") ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
