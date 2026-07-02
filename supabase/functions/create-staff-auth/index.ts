import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireEdgeSecret } from '../_shared/edgeAuth.ts';

interface StaffAuthRequest {
  email: string;
  password?: string;
  full_name: string;
  organization_id: string;
  role: 'staff' | 'section_manager' | 'manager' | 'executive';
  branch_id?: string;
  assigned_service_id?: string;
  date_of_birth?: string;
  address?: string;
}

interface BulkStaffRequest {
  staff: StaffAuthRequest[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    requireEdgeSecret(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const results: { email: string; success: boolean; error?: string; user_id?: string }[] = [];

    // Handle bulk or single request
    const staffList: StaffAuthRequest[] = body.staff || [body];

    console.log(`Processing ${staffList.length} staff auth requests`);

    for (const staffData of staffList) {
      const { email, password, full_name, organization_id, role, branch_id, assigned_service_id, date_of_birth, address } = staffData;

      // Generate password if not provided
      const staffPassword = password || `${email.split('@')[0]}@Staff2025!`;

      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        let userId: string;

        if (existingUser) {
          console.log(`User ${email} already exists, updating staff_role`);
          userId = existingUser.id;
        } else {
          // Create auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: staffPassword,
            email_confirm: true,
            user_metadata: {
              full_name,
              role,
            },
          });

          if (authError) {
            console.error(`Failed to create auth for ${email}:`, authError.message);
            results.push({ email, success: false, error: authError.message });
            continue;
          }

          userId = authData.user.id;
          console.log(`Created auth user for ${email} with ID ${userId}`);
        }

        // Check if staff_role exists
        const { data: existingRole } = await supabaseAdmin
          .from('staff_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('organization_id', organization_id)
          .single();

        if (existingRole) {
          // Update existing role
          const { error: updateError } = await supabaseAdmin
            .from('staff_roles')
            .update({
              full_name,
              email,
              role,
              branch_id: branch_id || null,
              assigned_service_id: assigned_service_id || null,
              date_of_birth: date_of_birth || null,
              address: address || null,
              is_active: true,
            })
            .eq('id', existingRole.id);

          if (updateError) {
            console.error(`Failed to update staff_role for ${email}:`, updateError.message);
            results.push({ email, success: false, error: updateError.message });
            continue;
          }
        } else {
          // Create staff_role
          const { error: roleError } = await supabaseAdmin
            .from('staff_roles')
            .insert({
              user_id: userId,
              email,
              full_name,
              organization_id,
              role,
              branch_id: branch_id || null,
              assigned_service_id: assigned_service_id || null,
              date_of_birth: date_of_birth || null,
              address: address || null,
              is_active: true,
            });

          if (roleError) {
            console.error(`Failed to create staff_role for ${email}:`, roleError.message);
            results.push({ email, success: false, error: roleError.message });
            continue;
          }
        }

        results.push({ email, success: true, user_id: userId });
        console.log(`Successfully processed ${email}`);

      } catch (err) {
        console.error(`Error processing ${email}:`, err);
        results.push({ email, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Completed: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        processed: results.length,
        successful: successCount,
        failed: failCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-staff-auth:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: message.includes('Unauthorized') ? 401 : 500,
      }
    );
  }
});
