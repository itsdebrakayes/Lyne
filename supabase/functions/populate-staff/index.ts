import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireEdgeSecret } from '../_shared/edgeAuth.ts';

// Jamaican-style name generators
const firstNames = [
  'Marcus', 'Shawn', 'Damion', 'Andre', 'Kemar', 'Tyrone', 'Devon', 'Omar', 'Ricardo', 'Gareth',
  'Kadian', 'Shantel', 'Tashana', 'Kimberly', 'Latoya', 'Marcia', 'Nadine', 'Paulette', 'Sharon', 'Simone',
  'Javon', 'Terrence', 'Winston', 'Delroy', 'Courtney', 'Dwayne', 'Kevin', 'Michael', 'Christopher', 'Rohan',
  'Tamara', 'Yolanda', 'Crystal', 'Natasha', 'Camille', 'Denise', 'Stacey', 'Nicole', 'Jodi', 'Racquel',
  'Brandon', 'Jermaine', 'Rasheed', 'Akeem', 'Horace', 'Linval', 'Everton', 'Fitzroy', 'Desmond', 'Leroy',
  'Sanya', 'Dionne', 'Shelly-Ann', 'Veronica', 'Keisha', 'Patrice', 'Annmarie', 'Sandra', 'Donna', 'Michelle'
];

const lastNames = [
  'Brown', 'Williams', 'Campbell', 'Stewart', 'Gordon', 'Smith', 'Thomas', 'Johnson', 'Wright', 'Anderson',
  'Henry', 'Davis', 'Morrison', 'Clarke', 'Lawrence', 'Bennett', 'Hamilton', 'Grant', 'Ferguson', 'Reid',
  'Powell', 'Richards', 'Robinson', 'Scott', 'Green', 'Martin', 'Edwards', 'Miller', 'Douglas', 'Walker',
  'Burke', 'Stephenson', 'Francis', 'Barrett', 'Beckford', 'Chambers', 'Thompson', 'Hudson', 'Spencer', 'Blake'
];

const addresses = [
  '12 Hope Road, Kingston 6',
  '45 Constant Spring Road, Kingston 8',
  '78 Half Way Tree Road, Kingston 10',
  '23 Old Hope Road, Kingston 5',
  '56 Waterloo Road, Kingston 10',
  '34 Duke Street, Downtown Kingston',
  '89 Spanish Town Road, St. Andrew',
  '15 Barbican Road, Kingston 6',
  '67 Mona Road, Kingston 7',
  '42 Red Hills Road, Kingston 19',
  '31 Portmore Parkway, St. Catherine',
  '55 Mandeville Town Centre, Manchester',
  '22 Montego Bay Boulevard, St. James',
  '18 Ocho Rios Drive, St. Ann',
  '73 Negril Point Road, Westmoreland'
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDateOfBirth(role: string): string {
  const now = new Date();
  let minAge: number, maxAge: number;
  
  switch (role) {
    case 'executive':
      minAge = 40; maxAge = 60;
      break;
    case 'manager':
      minAge = 35; maxAge = 55;
      break;
    case 'section_manager':
      minAge = 28; maxAge = 45;
      break;
    default:
      minAge = 22; maxAge = 40;
  }
  
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge));
  const dob = new Date(now.getFullYear() - age, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
  return dob.toISOString().split('T')[0];
}

function generateEmail(firstName: string, lastName: string, orgSlug: string, index: number): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${orgSlug}.gov.jm`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    requireEdgeSecret(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const targetOrg = body.organization_slug; // Required: 'taj', 'nht', or 'pica'
    const targetBranchName = body.branch_name; // Optional: specific branch name
    const staffCount = body.staff_count || 20; // Default 20 staff
    const managerCount = body.manager_count || 10; // Default 10 managers
    const execCount = body.exec_count || 3; // Default 3 executives

    if (!targetOrg) {
      return new Response(
        JSON.stringify({ error: 'organization_slug is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Fetch organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', targetOrg)
      .single();
    
    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: `Organization '${targetOrg}' not found` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch branches for this org
    let branchQuery = supabaseAdmin
      .from('branches')
      .select('id, name, organization_id')
      .eq('organization_id', org.id);
    
    if (targetBranchName) {
      branchQuery = branchQuery.eq('name', targetBranchName);
    }

    const { data: branches, error: branchError } = await branchQuery;
    
    if (branchError || !branches || branches.length === 0) {
      return new Response(
        JSON.stringify({ error: `No branches found for organization '${targetOrg}'` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch services for this org
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name')
      .eq('organization_id', org.id);

    const results: { branch: string; created: number; errors: number; details: string[] }[] = [];
    let globalIndex = Date.now(); // Use timestamp for unique emails

    for (const branch of branches) {
      let createdCount = 0;
      let errorCount = 0;
      const details: string[] = [];

      // Generate staff for this branch
      const staffToCreate = [
        ...Array(staffCount).fill('staff'),
        ...Array(managerCount).fill('manager'),
        ...Array(execCount).fill('executive'),
      ];

      console.log(`Processing branch: ${branch.name} - ${staffToCreate.length} staff to create`);

      for (let i = 0; i < staffToCreate.length; i++) {
        const role = staffToCreate[i];
        const firstName = randomFrom(firstNames);
        const lastName = randomFrom(lastNames);
        const fullName = `${firstName} ${lastName}`;
        const email = generateEmail(firstName, lastName, org.slug, globalIndex++);
        const dob = generateDateOfBirth(role);
        const address = randomFrom(addresses);
        const assignedService = role === 'staff' && services && services.length > 0 
          ? randomFrom(services).id 
          : null;

        const password = `${firstName.toLowerCase()}@Staff2025!`;

        try {
          // Create auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
          });

          if (authError) {
            console.error(`Auth error for ${email}:`, authError.message);
            errorCount++;
            details.push(`Auth error: ${email} - ${authError.message}`);
            continue;
          }

          // Create staff role
          const { error: roleError } = await supabaseAdmin
            .from('staff_roles')
            .insert({
              user_id: authData.user.id,
              email,
              full_name: fullName,
              organization_id: org.id,
              branch_id: branch.id,
              role,
              date_of_birth: dob,
              address,
              assigned_service_id: assignedService,
              is_active: true,
            });

          if (roleError) {
            console.error(`Role error for ${email}:`, roleError.message);
            errorCount++;
            details.push(`Role error: ${email} - ${roleError.message}`);
            continue;
          }

          createdCount++;
          console.log(`Created ${role}: ${fullName} (${email})`);

        } catch (err) {
          console.error(`Error creating staff ${email}:`, err);
          errorCount++;
          details.push(`Error: ${email} - ${String(err)}`);
        }
      }

      results.push({
        branch: branch.name,
        created: createdCount,
        errors: errorCount,
        details,
      });
    }

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`Completed: ${totalCreated} created, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        organization: org.name,
        totalCreated,
        totalErrors,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in populate-staff:', error);
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
