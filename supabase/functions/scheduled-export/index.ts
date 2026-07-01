import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireEdgeSecret } from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    requireEdgeSecret(req);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: msg.includes("Unauthorized") ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting scheduled export...");

  try {
    // Get all active organizations
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("is_active", true);

    if (orgsError) throw orgsError;

    console.log(`Found ${organizations?.length || 0} active organizations`);

    const results: Record<string, { success: boolean; tables: string[]; error?: string }> = {};

    for (const org of organizations || []) {
      console.log(`Exporting data for organization: ${org.name} (${org.id})`);

      try {
        const exportedTables: string[] = [];

        // Export visits
        const { data: visits } = await supabase
          .from("visit_history")
          .select("*")
          .eq("organization_id", org.id);

        if (visits && visits.length > 0) {
          const csv = convertToCSV(visits, [
            "id", "visit_date", "day_of_week", "hour_of_day", "service_id",
            "wait_time_minutes", "service_time_minutes", "was_cancelled", "was_no_show"
          ]);
          await uploadToStorage(supabase, org.id, "visits.csv", csv);
          exportedTables.push("visits");
        }

        // Export queue events from lines table
        const { data: lines } = await supabase
          .from("lines")
          .select("*, service_sessions(*)")
          .eq("organization_id", org.id);

        if (lines && lines.length > 0) {
          const events = reconstructQueueEvents(lines);
          const csv = convertToCSV(events, [
            "event_id", "visit_id", "event_time", "event_type", "staff_id", "counter_id", "service_id"
          ]);
          await uploadToStorage(supabase, org.id, "queue_events.csv", csv);
          exportedTables.push("queue_events");
        }

        // Export staff service log
        const { data: sessions } = await supabase
          .from("service_sessions")
          .select("*, lines!inner(organization_id)")
          .eq("lines.organization_id", org.id);

        if (sessions && sessions.length > 0) {
          const csv = convertToCSV(sessions, [
            "id", "line_id", "staff_user_id", "counter_id", "started_at", "completed_at", "duration_minutes", "outcome"
          ]);
          await uploadToStorage(supabase, org.id, "staff_service_log.csv", csv);
          exportedTables.push("staff_service_log");
        }

        // Export services
        const { data: services } = await supabase
          .from("services")
          .select("*")
          .eq("organization_id", org.id)
          .eq("is_active", true);

        if (services && services.length > 0) {
          const csv = convertToCSV(services, [
            "id", "name", "organization_id", "base_avg_time_minutes", "is_active", "display_order", "color"
          ]);
          await uploadToStorage(supabase, org.id, "services.csv", csv);
          exportedTables.push("services");
        }

        // Export counters
        const { data: counters } = await supabase
          .from("counters")
          .select("*")
          .eq("organization_id", org.id);

        if (counters && counters.length > 0) {
          const csv = convertToCSV(counters, [
            "id", "organization_id", "service_id", "counter_number", "is_active"
          ]);
          await uploadToStorage(supabase, org.id, "counters.csv", csv);
          exportedTables.push("counters");
        }

        // Log successful export
        await supabase.from("export_logs").insert({
          organization_id: org.id,
          export_type: "scheduled_daily",
          status: "success",
          row_count: exportedTables.length,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        results[org.id] = { success: true, tables: exportedTables };
        console.log(`Successfully exported ${exportedTables.length} tables for ${org.name}`);

      } catch (orgError) {
        console.error(`Error exporting for org ${org.id}:`, orgError);
        
        await supabase.from("export_logs").insert({
          organization_id: org.id,
          export_type: "scheduled_daily",
          status: "error",
          error_message: orgError instanceof Error ? orgError.message : String(orgError),
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        results[org.id] = { 
          success: false, 
          tables: [], 
          error: orgError instanceof Error ? orgError.message : String(orgError) 
        };
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scheduled export failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function convertToCSV(data: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return "";
      if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function reconstructQueueEvents(lines: Record<string, unknown>[]): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  let eventId = 1;

  for (const line of lines) {
    const lineRecord = line as { 
      id: string; 
      service_id: string; 
      joined_at?: string; 
      called_at?: string; 
      started_serving_at?: string; 
      completed_at?: string; 
      status?: string;
      service_sessions?: Array<{ staff_user_id?: string; counter_id?: string }>;
    };
    
    const session = Array.isArray(lineRecord.service_sessions) ? lineRecord.service_sessions[0] : null;

    if (lineRecord.joined_at) {
      events.push({
        event_id: eventId++,
        visit_id: lineRecord.id,
        event_time: lineRecord.joined_at,
        event_type: "created",
        staff_id: null,
        counter_id: null,
        service_id: lineRecord.service_id,
      });
    }

    if (lineRecord.called_at) {
      events.push({
        event_id: eventId++,
        visit_id: lineRecord.id,
        event_time: lineRecord.called_at,
        event_type: "called",
        staff_id: session?.staff_user_id || null,
        counter_id: session?.counter_id || null,
        service_id: lineRecord.service_id,
      });
    }

    if (lineRecord.started_serving_at) {
      events.push({
        event_id: eventId++,
        visit_id: lineRecord.id,
        event_time: lineRecord.started_serving_at,
        event_type: "serving",
        staff_id: session?.staff_user_id || null,
        counter_id: session?.counter_id || null,
        service_id: lineRecord.service_id,
      });
    }

    if (lineRecord.completed_at) {
      const eventType = lineRecord.status === "cancelled" ? "cancelled" 
        : lineRecord.status === "no_show" ? "no_show" 
        : "completed";
      events.push({
        event_id: eventId++,
        visit_id: lineRecord.id,
        event_time: lineRecord.completed_at,
        event_type: eventType,
        staff_id: session?.staff_user_id || null,
        counter_id: session?.counter_id || null,
        service_id: lineRecord.service_id,
      });
    }
  }

  return events.sort((a, b) => 
    new Date(a.event_time as string).getTime() - new Date(b.event_time as string).getTime()
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadToStorage(
  supabase: SupabaseClient<any, any, any>,
  orgId: string,
  filename: string,
  content: string
): Promise<void> {
  const path = `exports/${orgId}/${filename}`;
  const { error } = await supabase.storage
    .from("analytics-data")
    .upload(path, content, {
      contentType: "text/csv",
      upsert: true,
    });

  if (error) {
    console.error(`Failed to upload ${path}:`, error);
    throw error;
  }
  console.log(`Uploaded ${path}`);
}
