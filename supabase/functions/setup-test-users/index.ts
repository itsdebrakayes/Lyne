import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireEdgeSecret } from "../_shared/edgeAuth.ts";

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role: "staff" | "section_manager" | "manager" | "executive";
  orgSlug: string;
  assignedSection?: string; // For section_managers
}

const testUsers: TestUser[] = [
  // TAJ users
  { email: "staff@taj.test", password: "test123", fullName: "TAJ Staff User", role: "staff", orgSlug: "taj" },
  { email: "section@taj.test", password: "test123", fullName: "TAJ Section Manager", role: "section_manager", orgSlug: "taj", assignedSection: "Cashier" },
  { email: "manager@taj.test", password: "test123", fullName: "TAJ Manager", role: "manager", orgSlug: "taj" },
  { email: "exec@taj.test", password: "test123", fullName: "TAJ Executive", role: "executive", orgSlug: "taj" },
  // NHT users
  { email: "staff@nht.test", password: "test123", fullName: "NHT Staff User", role: "staff", orgSlug: "nht" },
  { email: "section@nht.test", password: "test123", fullName: "NHT Section Manager", role: "section_manager", orgSlug: "nht", assignedSection: "Contributions" },
  { email: "manager@nht.test", password: "test123", fullName: "NHT Manager", role: "manager", orgSlug: "nht" },
  { email: "exec@nht.test", password: "test123", fullName: "NHT Executive", role: "executive", orgSlug: "nht" },
  // PICA users
  { email: "staff@pica.test", password: "test123", fullName: "PICA Staff User", role: "staff", orgSlug: "pica" },
  { email: "section@pica.test", password: "test123", fullName: "PICA Section Manager", role: "section_manager", orgSlug: "pica", assignedSection: "New Applications" },
  { email: "manager@pica.test", password: "test123", fullName: "PICA Manager", role: "manager", orgSlug: "pica" },
  { email: "exec@pica.test", password: "test123", fullName: "PICA Executive", role: "executive", orgSlug: "pica" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    requireEdgeSecret(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; details?: string; error?: string }[] = [];

    // Get org IDs
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, slug");

    if (orgError) throw orgError;

    const orgMap = new Map(orgs.map(o => [o.slug, o.id]));

    // Get services for each org
    const { data: allServices } = await supabaseAdmin
      .from("services")
      .select("id, organization_id, name")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const servicesByOrg = new Map<string, typeof allServices>();
    for (const service of allServices || []) {
      const existing = servicesByOrg.get(service.organization_id) || [];
      existing.push(service);
      servicesByOrg.set(service.organization_id, existing);
    }

    // Get counters for each org
    const { data: allCounters } = await supabaseAdmin
      .from("counters")
      .select("id, organization_id, service_id, counter_number")
      .eq("is_active", true)
      .order("counter_number", { ascending: true });

    const countersByService = new Map<string, typeof allCounters>();
    for (const counter of allCounters || []) {
      const existing = countersByService.get(counter.service_id) || [];
      existing.push(counter);
      countersByService.set(counter.service_id, existing);
    }

    for (const user of testUsers) {
      try {
        const orgId = orgMap.get(user.orgSlug);
        if (!orgId) {
          results.push({ email: user.email, status: "skipped", error: `Org ${user.orgSlug} not found` });
          continue;
        }

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create auth user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { full_name: user.fullName },
          });

          if (createError) {
            results.push({ email: user.email, status: "error", error: createError.message });
            continue;
          }

          userId = newUser.user.id;
        }

        // Get first service for this org (for staff assignment)
        const orgServices = servicesByOrg.get(orgId) || [];
        const firstService = orgServices[0];
        let assignedServiceId: string | null = null;
        let counterId: string | null = null;
        let assignedSection: string | null = null;

        // Determine assignments based on role
        if (user.role === "staff" && firstService) {
          // Staff: assign to first service and first counter of that service
          assignedServiceId = firstService.id;
          const serviceCounters = countersByService.get(firstService.id) || [];
          if (serviceCounters.length > 0) {
            counterId = serviceCounters[0].id;
          }
        } else if (user.role === "section_manager") {
          // Section manager: assign section but no specific counter
          assignedSection = user.assignedSection || null;
          // Find service matching section name
          const sectionService = orgServices.find(s => 
            s.name.toLowerCase().includes((user.assignedSection || '').toLowerCase())
          );
          if (sectionService) {
            assignedServiceId = sectionService.id;
          }
        }
        // Managers and executives: no service assignment (see all)

        // Check if staff role exists
        const { data: existingRole } = await supabaseAdmin
          .from("staff_roles")
          .select("id, assigned_service_id, assigned_section")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .single();

        if (existingRole) {
          // Update existing role with service assignment if needed
          const updates: any = {};
          if (assignedServiceId && !existingRole.assigned_service_id) {
            updates.assigned_service_id = assignedServiceId;
          }
          if (assignedSection && !existingRole.assigned_section) {
            updates.assigned_section = assignedSection;
          }
          
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin
              .from("staff_roles")
              .update(updates)
              .eq("id", existingRole.id);
          }

          results.push({ 
            email: user.email, 
            status: "updated", 
            details: `Service: ${assignedServiceId || 'none'}, Section: ${assignedSection || 'none'}` 
          });
        } else {
          // Create staff role with assignments
          const { error: roleError } = await supabaseAdmin
            .from("staff_roles")
            .insert({
              user_id: userId,
              organization_id: orgId,
              role: user.role,
              is_active: true,
              assigned_service_id: assignedServiceId,
              assigned_section: assignedSection,
            });

          if (roleError) {
            console.error(`Error creating role for ${user.email}:`, roleError);
            results.push({ email: user.email, status: "error", error: roleError.message });
            continue;
          }

          results.push({ 
            email: user.email, 
            status: "created", 
            details: `Role: ${user.role}, Service: ${assignedServiceId || 'none'}` 
          });
        }

        // Create counter assignment for staff if counter found
        if (counterId && (user.role === "staff" || user.role === "section_manager")) {
          const today = new Date().toISOString().split('T')[0];
          
          // Check if assignment exists
          const { data: existingAssignment } = await supabaseAdmin
            .from("counter_assignments")
            .select("id")
            .eq("staff_user_id", userId)
            .eq("counter_id", counterId)
            .eq("assignment_date", today)
            .single();

          if (!existingAssignment) {
            await supabaseAdmin
              .from("counter_assignments")
              .insert({
                staff_user_id: userId,
                counter_id: counterId,
                assignment_date: today,
                shift_start: "08:00:00",
                shift_end: "17:00:00",
              });
          }
        }

      } catch (userError) {
        results.push({ email: user.email, status: "error", error: String(userError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Setup error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: message.includes("Unauthorized") ? 401 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
