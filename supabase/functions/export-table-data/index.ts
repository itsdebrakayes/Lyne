import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExportRequest {
  tables?: string[];
  organization_id: string;
  date_from?: string;
  date_to?: string;
  // Optional: override bucket/path base
  bucket?: string;
  base_path?: string; // default analytics/{org}/data_exports
}

function safeStr(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

async function uploadCsv(
  supabase: any,
  bucket: string,
  path: string,
  csv: string
) {
  // Ensure we upload bytes
  const content = new TextEncoder().encode(csv);

  const { error } = await supabase.storage.from(bucket).upload(path, content, {
    upsert: true,
    contentType: "text/csv; charset=utf-8",
    cacheControl: "0",
  });

  if (error) throw error;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ExportRequest = await req.json();

    const organization_id = body.organization_id;
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bucket & path
    const bucket = body.bucket || "analytics-data";
    const basePath = body.base_path || `analytics/${organization_id}/data_exports`;

    const dateFrom =
      body.date_from ||
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dateTo = body.date_to || new Date().toISOString().split("T")[0];

    console.log(`Exporting CSVs to bucket '${bucket}' at '${basePath}'`);
    console.log(`Org ${organization_id} from ${dateFrom} to ${dateTo}`);

    const tables = body.tables?.length
      ? body.tables
      : ["visits", "queue_events", "staff_service_log", "services", "counters"];

    const results: Record<
      string,
      { ok: boolean; storage_path?: string; error?: string }
    > = {};

    for (const table of tables) {
      try {
        let csv = "";
        let filename = "";

        switch (table) {
          case "visits":
            csv = await exportVisits(supabase, organization_id, dateFrom, dateTo);
            filename = "visits.csv";
            break;

          case "queue_events":
            csv = await exportQueueEvents(supabase, organization_id, dateFrom, dateTo);
            filename = "queue_events.csv";
            break;

          case "staff_service_log":
            csv = await exportStaffServiceLog(supabase, organization_id, dateFrom, dateTo);
            filename = "staff_service_log.csv";
            break;

          case "services":
            csv = await exportServices(supabase, organization_id);
            filename = "services.csv";
            break;

          case "counters":
            csv = await exportCounters(supabase, organization_id);
            filename = "counters.csv";
            break;

          default:
            results[table] = { ok: false, error: `Unknown table: ${table}` };
            continue;
        }

        const storagePath = `${basePath}/${filename}`;
        await uploadCsv(supabase, bucket, storagePath, csv);

        results[table] = { ok: true, storage_path: storagePath };
      } catch (err) {
        console.error(`Error exporting ${table}:`, err);
        results[table] = {
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // Optional: log the export (only if table exists)
    // If export_logs doesn't exist, this won't break the function.
    try {
      await supabase.from("export_logs").insert({
        organization_id,
        export_type: "manual",
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        bucket,
        base_path: basePath,
        period: { from: dateFrom, to: dateTo },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --------------------
// Your export helpers (mostly unchanged)
// --------------------

async function exportVisits(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from("visit_history")
    .select(`
      id,
      visit_date,
      day_of_week,
      hour_of_day,
      service_id,
      wait_time_minutes,
      service_time_minutes,
      was_cancelled,
      was_no_show,
      services(name)
    `)
    .eq("organization_id", orgId)
    .gte("visit_date", dateFrom)
    .lte("visit_date", dateTo)
    .order("visit_date", { ascending: true });

  if (error) throw error;

  const header =
    "visit_id,timestamp,dow,hour,is_weekend,service_id,service_name,branch_id,wait_time_minutes,service_time_minutes,status";

  const rows = (data || []).map((row: any) => {
    const timestamp = `${row.visit_date}T${String(row.hour_of_day).padStart(2, "0")}:00:00Z`;
    const isWeekend = row.day_of_week === 0 || row.day_of_week === 6 ? 1 : 0;
    const status = row.was_cancelled ? "cancelled" : row.was_no_show ? "no_show" : "completed";
    const serviceName = row.services?.name || "";

    // CSV-safe quoting for service_name
    const serviceNameEsc = `"${String(serviceName).replaceAll('"', '""')}"`;

    return [
      row.id,
      timestamp,
      row.day_of_week,
      row.hour_of_day,
      isWeekend,
      row.service_id || "",
      serviceNameEsc,
      "", // branch_id (not in visit_history)
      row.wait_time_minutes ?? "",
      row.service_time_minutes ?? "",
      status,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

async function exportQueueEvents(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from("lines")
    .select(`
      id,
      service_id,
      status,
      joined_at,
      called_at,
      started_serving_at,
      completed_at,
      service_sessions(staff_user_id, counter_id)
    `)
    .eq("organization_id", orgId)
    .gte("joined_at", `${dateFrom}T00:00:00Z`)
    .lte("joined_at", `${dateTo}T23:59:59Z`)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const header = "event_id,visit_id,event_time,event_type,staff_id,counter_id,service_id";
  const events: string[] = [];

  for (const line of data || []) {
    const session = line.service_sessions?.[0];
    const staffId = session?.staff_user_id || "";
    const counterId = session?.counter_id || "";

    if (line.joined_at) {
      events.push([`${line.id}-created`, line.id, line.joined_at, "created", "", "", line.service_id].join(","));
    }
    if (line.called_at) {
      events.push([`${line.id}-called`, line.id, line.called_at, "called", staffId, counterId, line.service_id].join(","));
    }
    if (line.started_serving_at) {
      events.push([`${line.id}-serving`, line.id, line.started_serving_at, "serving", staffId, counterId, line.service_id].join(","));
    }
    if (line.completed_at) {
      const eventType =
        line.status === "cancelled" ? "cancelled" :
        line.status === "no_show" ? "no_show" : "completed";

      events.push([`${line.id}-${eventType}`, line.id, line.completed_at, eventType, staffId, counterId, line.service_id].join(","));
    }
  }

  return [header, ...events].join("\n");
}

async function exportStaffServiceLog(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from("service_sessions")
    .select(`
      id,
      line_id,
      staff_user_id,
      counter_id,
      started_at,
      completed_at,
      duration_minutes,
      outcome,
      lines!inner(organization_id, service_id)
    `)
    .eq("lines.organization_id", orgId)
    .gte("started_at", `${dateFrom}T00:00:00Z`)
    .lte("started_at", `${dateTo}T23:59:59Z`)
    .order("started_at", { ascending: true });

  if (error) throw error;

  const header = "session_id,visit_id,staff_id,service_id,counter_id,start_time,end_time,duration_minutes,outcome";

  const rows = (data || []).map((row: any) => [
    row.id,
    row.line_id,
    row.staff_user_id || "",
    row.lines?.service_id || "",
    row.counter_id || "",
    row.started_at || "",
    row.completed_at || "",
    row.duration_minutes ?? "",
    row.outcome || "completed",
  ].join(","));

  return [header, ...rows].join("\n");
}

async function exportServices(supabase: any, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from("services")
    .select("id,name,organization_id,base_avg_time_minutes,is_active,display_order,color")
    .eq("organization_id", orgId)
    .order("display_order", { ascending: true });

  if (error) throw error;

  const header = "service_id,service_name,organization_id,base_avg_time_minutes,is_active,display_order,color";

  const rows = (data || []).map((row: any) => {
    const nameEsc = `"${String(row.name ?? "").replaceAll('"', '""')}"`;
    return [
      row.id,
      nameEsc,
      row.organization_id,
      row.base_avg_time_minutes ?? "",
      row.is_active,
      row.display_order ?? "",
      row.color ?? "",
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

async function exportCounters(supabase: any, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from("counters")
    .select("id,organization_id,service_id,counter_number,is_active")
    .eq("organization_id", orgId)
    .order("counter_number", { ascending: true });

  if (error) throw error;

  const header = "counter_id,organization_id,service_id,counter_number,is_active";

  const rows = (data || []).map((row: any) => [
    row.id,
    row.organization_id,
    row.service_id,
    row.counter_number,
    row.is_active,
  ].join(","));

  return [header, ...rows].join("\n");
}
