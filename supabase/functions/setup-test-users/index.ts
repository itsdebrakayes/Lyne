import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role: "staff" | "section_manager" | "manager" | "executive";
  orgSlug: string;
}

const testUsers: TestUser[] = [
  // TAJ users
  { email: "staff@taj.test", password: "test123", fullName: "TAJ Staff User", role: "staff", orgSlug: "taj" },
  { email: "manager@taj.test", password: "test123", fullName: "TAJ Manager", role: "manager", orgSlug: "taj" },
  { email: "exec@taj.test", password: "test123", fullName: "TAJ Executive", role: "executive", orgSlug: "taj" },
  // NHT users
  { email: "staff@nht.test", password: "test123", fullName: "NHT Staff User", role: "staff", orgSlug: "nht" },
  { email: "manager@nht.test", password: "test123", fullName: "NHT Manager", role: "manager", orgSlug: "nht" },
  { email: "exec@nht.test", password: "test123", fullName: "NHT Executive", role: "executive", orgSlug: "nht" },
  // PICA users
  { email: "staff@pica.test", password: "test123", fullName: "PICA Staff User", role: "staff", orgSlug: "pica" },
  { email: "manager@pica.test", password: "test123", fullName: "PICA Manager", role: "manager", orgSlug: "pica" },
  { email: "exec@pica.test", password: "test123", fullName: "PICA Executive", role: "executive", orgSlug: "pica" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; error?: string }[] = [];

    // Get org IDs
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, slug");

    if (orgError) throw orgError;

    const orgMap = new Map(orgs.map(o => [o.slug, o.id]));

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
          results.push({ email: user.email, status: "exists" });
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
          results.push({ email: user.email, status: "created" });
        }

        // Check if staff role exists
        const { data: existingRole } = await supabaseAdmin
          .from("staff_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .single();

        if (!existingRole) {
          // Create staff role
          const { error: roleError } = await supabaseAdmin
            .from("staff_roles")
            .insert({
              user_id: userId,
              organization_id: orgId,
              role: user.role,
              is_active: true,
            });

          if (roleError) {
            console.error(`Error creating role for ${user.email}:`, roleError);
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
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
