import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSIGHT_TYPES = ["ops_insights", "staff_metrics", "client_predictions"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting analytics sync...");

  try {
    // Get all active organizations
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name");

    if (orgsError) throw orgsError;

    const results: Record<string, { synced: string[]; errors: string[] }> = {};

    for (const org of organizations || []) {
      console.log(`Checking for new insights for: ${org.name}`);
      results[org.id] = { synced: [], errors: [] };

      for (const insightType of INSIGHT_TYPES) {
        try {
          const path = `outputs/${insightType}/${org.id}.json`;
          
          // Try to download the output file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("analytics-data")
            .download(path);

          if (downloadError) {
            // File doesn't exist yet, skip
            console.log(`No output file found: ${path}`);
            continue;
          }

          const content = await fileData.text();
          const outputData = JSON.parse(content);

          // Check if we already have this insight (by generated_at timestamp)
          const { data: existingInsight } = await supabase
            .from("analytics_insights")
            .select("id, generated_at")
            .eq("organization_id", org.id)
            .eq("insight_type", insightType)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const newGeneratedAt = outputData.generated_at || outputData.meta?.generated_at;
          
          if (existingInsight && existingInsight.generated_at === newGeneratedAt) {
            console.log(`Insight ${insightType} for ${org.id} already up to date`);
            continue;
          }

          // Expire old insights of this type
          await supabase
            .from("analytics_insights")
            .update({ expires_at: new Date().toISOString() })
            .eq("organization_id", org.id)
            .eq("insight_type", insightType)
            .is("expires_at", null);

          // Insert new insight
          const { error: insertError } = await supabase
            .from("analytics_insights")
            .insert({
              organization_id: org.id,
              insight_type: insightType,
              data: outputData.data || outputData,
              generated_at: newGeneratedAt || new Date().toISOString(),
              period_start: outputData.period_start || outputData.meta?.period_start || new Date().toISOString(),
              period_end: outputData.period_end || outputData.meta?.period_end || new Date().toISOString(),
              notebook_version: outputData.notebook_version || outputData.meta?.notebook_version,
            });

          if (insertError) throw insertError;

          results[org.id].synced.push(insightType);
          console.log(`Synced ${insightType} for ${org.name}`);

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          results[org.id].errors.push(`${insightType}: ${errorMsg}`);
          console.error(`Error syncing ${insightType} for ${org.id}:`, err);
        }
      }
    }

    const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced.length, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

    console.log(`Sync complete: ${totalSynced} insights synced, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({ success: true, totalSynced, totalErrors, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analytics sync failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
