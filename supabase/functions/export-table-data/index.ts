import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExportRequest {
  tables: string[];
  organization_id: string;
  date_from?: string;
  date_to?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tables, organization_id, date_from, date_to }: ExportRequest = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dateFrom = date_from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = date_to || new Date().toISOString().split('T')[0];

    console.log(`Exporting data for org ${organization_id} from ${dateFrom} to ${dateTo}`);

    const exports: Record<string, string> = {};

    for (const table of tables || ['visits', 'queue_events', 'staff_service_log', 'services', 'counters']) {
      try {
        switch (table) {
          case 'visits':
            exports.visits = await exportVisits(supabase, organization_id, dateFrom, dateTo);
            break;
          case 'queue_events':
            exports.queue_events = await exportQueueEvents(supabase, organization_id, dateFrom, dateTo);
            break;
          case 'staff_service_log':
            exports.staff_service_log = await exportStaffServiceLog(supabase, organization_id, dateFrom, dateTo);
            break;
          case 'services':
            exports.services = await exportServices(supabase, organization_id);
            break;
          case 'counters':
            exports.counters = await exportCounters(supabase, organization_id);
            break;
          default:
            console.log(`Unknown table: ${table}`);
        }
      } catch (err) {
        console.error(`Error exporting ${table}:`, err);
        exports[table] = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    }

    // Log the export
    await supabase.from('export_logs').insert({
      organization_id,
      export_type: 'manual',
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        exports,
        period: { from: dateFrom, to: dateTo }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Export visits.csv - Transform visit_history to the expected format
async function exportVisits(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from('visit_history')
    .select(`
      id,
      visit_date,
      day_of_week,
      hour_of_day,
      service_id,
      client_id,
      wait_time_minutes,
      service_time_minutes,
      was_cancelled,
      was_no_show,
      services(name)
    `)
    .eq('organization_id', orgId)
    .gte('visit_date', dateFrom)
    .lte('visit_date', dateTo)
    .order('visit_date', { ascending: true });

  if (error) throw error;

  // CSV header
  const header = 'visit_id,timestamp,dow,hour,is_weekend,service_id,service_name,branch_id,wait_time_minutes,service_time_minutes,status';
  
  const rows = (data || []).map((row: any) => {
    // Construct ISO timestamp from date + hour
    const timestamp = `${row.visit_date}T${String(row.hour_of_day).padStart(2, '0')}:00:00Z`;
    const isWeekend = row.day_of_week === 0 || row.day_of_week === 6 ? 1 : 0;
    const status = row.was_cancelled ? 'cancelled' : row.was_no_show ? 'no_show' : 'completed';
    const serviceName = row.services?.name || '';

    return [
      row.id,
      timestamp,
      row.day_of_week,
      row.hour_of_day,
      isWeekend,
      row.service_id || '',
      `"${serviceName}"`,
      '', // branch_id - would need join
      row.wait_time_minutes || 0,
      row.service_time_minutes || 0,
      status
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

// Export queue_events.csv - Reconstruct events from lines table
async function exportQueueEvents(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from('lines')
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
    .eq('organization_id', orgId)
    .gte('joined_at', `${dateFrom}T00:00:00Z`)
    .lte('joined_at', `${dateTo}T23:59:59Z`)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  const header = 'event_id,visit_id,event_time,event_type,staff_id,counter_id,service_id';
  const events: string[] = [];

  for (const line of (data || [])) {
    const session = line.service_sessions?.[0];
    const staffId = session?.staff_user_id || '';
    const counterId = session?.counter_id || '';

    // Created event
    if (line.joined_at) {
      events.push([
        `${line.id}-created`,
        line.id,
        line.joined_at,
        'created',
        '',
        '',
        line.service_id
      ].join(','));
    }

    // Called event
    if (line.called_at) {
      events.push([
        `${line.id}-called`,
        line.id,
        line.called_at,
        'called',
        staffId,
        counterId,
        line.service_id
      ].join(','));
    }

    // Serving event
    if (line.started_serving_at) {
      events.push([
        `${line.id}-serving`,
        line.id,
        line.started_serving_at,
        'serving',
        staffId,
        counterId,
        line.service_id
      ].join(','));
    }

    // Final event based on status
    if (line.completed_at) {
      const eventType = line.status === 'cancelled' ? 'cancelled' 
                      : line.status === 'no_show' ? 'no_show' 
                      : 'completed';
      events.push([
        `${line.id}-${eventType}`,
        line.id,
        line.completed_at,
        eventType,
        staffId,
        counterId,
        line.service_id
      ].join(','));
    }
  }

  return [header, ...events].join('\n');
}

// Export staff_service_log.csv from service_sessions
async function exportStaffServiceLog(supabase: any, orgId: string, dateFrom: string, dateTo: string): Promise<string> {
  const { data, error } = await supabase
    .from('service_sessions')
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
    .eq('lines.organization_id', orgId)
    .gte('started_at', `${dateFrom}T00:00:00Z`)
    .lte('started_at', `${dateTo}T23:59:59Z`)
    .order('started_at', { ascending: true });

  if (error) throw error;

  const header = 'session_id,visit_id,staff_id,service_id,counter_id,start_time,end_time,duration_minutes,outcome';
  
  const rows = (data || []).map((row: any) => [
    row.id,
    row.line_id,
    row.staff_user_id || '',
    row.lines?.service_id || '',
    row.counter_id || '',
    row.started_at || '',
    row.completed_at || '',
    row.duration_minutes || 0,
    row.outcome || 'completed'
  ].join(','));

  return [header, ...rows].join('\n');
}

// Export services.csv
async function exportServices(supabase: any, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;

  const header = 'service_id,service_name,organization_id,base_avg_time_minutes,is_active,display_order,color';
  
  const rows = (data || []).map((row: any) => [
    row.id,
    `"${row.name}"`,
    row.organization_id,
    row.base_avg_time_minutes || 10,
    row.is_active,
    row.display_order || 0,
    row.color || '#3B82F6'
  ].join(','));

  return [header, ...rows].join('\n');
}

// Export counters.csv
async function exportCounters(supabase: any, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('counters')
    .select('*')
    .eq('organization_id', orgId)
    .order('counter_number', { ascending: true });

  if (error) throw error;

  const header = 'counter_id,organization_id,service_id,counter_number,is_active';
  
  const rows = (data || []).map((row: any) => [
    row.id,
    row.organization_id,
    row.service_id,
    row.counter_number,
    row.is_active
  ].join(','));

  return [header, ...rows].join('\n');
}
