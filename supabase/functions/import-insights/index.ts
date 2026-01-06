import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InsightImport {
  organization_id: string;
  insight_type: string;
  period_start: string;
  period_end: string;
  data: Record<string, any>;
  notebook_version?: string;
}

const VALID_INSIGHT_TYPES = [
  'peak_hours',
  'dropoff_periods', 
  'best_times',
  'anomalies',
  'service_efficiency',
  'staff_metrics',
  'recommendations',
  'client_predictions',
  'ops_insights', // Combined admin insights
  'data_health'   // Data quality report
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InsightImport | InsightImport[] = await req.json();
    
    // Support batch import
    const imports = Array.isArray(body) ? body : [body];
    const results: { success: boolean; id?: string; error?: string; insight_type: string }[] = [];

    for (const insight of imports) {
      try {
        // Validate required fields
        if (!insight.organization_id || !insight.insight_type || !insight.data) {
          results.push({
            success: false,
            insight_type: insight.insight_type || 'unknown',
            error: 'Missing required fields: organization_id, insight_type, data'
          });
          continue;
        }

        // Validate insight type
        if (!VALID_INSIGHT_TYPES.includes(insight.insight_type)) {
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: `Invalid insight_type. Must be one of: ${VALID_INSIGHT_TYPES.join(', ')}`
          });
          continue;
        }

        // Verify organization exists
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', insight.organization_id)
          .single();

        if (orgError || !org) {
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: 'Organization not found'
          });
          continue;
        }

        // Mark old insights of same type as expired
        await supabase
          .from('analytics_insights')
          .update({ expires_at: new Date().toISOString() })
          .eq('organization_id', insight.organization_id)
          .eq('insight_type', insight.insight_type)
          .is('expires_at', null);

        // Insert new insight
        const { data: newInsight, error: insertError } = await supabase
          .from('analytics_insights')
          .insert({
            organization_id: insight.organization_id,
            insight_type: insight.insight_type,
            data: insight.data,
            period_start: insight.period_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            period_end: insight.period_end || new Date().toISOString().split('T')[0],
            notebook_version: insight.notebook_version || null,
            generated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          results.push({
            success: false,
            insight_type: insight.insight_type,
            error: insertError.message
          });
          continue;
        }

        console.log(`Successfully imported ${insight.insight_type} insight for org ${insight.organization_id}`);
        results.push({
          success: true,
          insight_type: insight.insight_type,
          id: newInsight.id
        });

      } catch (err) {
        console.error('Processing error:', err);
        results.push({
          success: false,
          insight_type: insight.insight_type || 'unknown',
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const allSuccessful = results.every(r => r.success);
    
    return new Response(
      JSON.stringify({ 
        success: allSuccessful,
        results,
        imported_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length
      }),
      { 
        status: allSuccessful ? 200 : 207, // 207 Multi-Status for partial success
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
