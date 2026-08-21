#!/usr/bin/env node

/**
 * Links pre-created Supabase Auth demo/test accounts to the MySQL demo data.
 *
 * This is intentionally opt-in and production-blocked. It is for local/demo
 * verification only, after the matching Supabase Auth users already exist.
 */

const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { refreshDemoData } = require('./refresh-demo-data');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to sync demo/test accounts while NODE_ENV=production.');
  process.exit(1);
}

if (process.env.ALLOW_DEMO_TEST_ACCOUNT_SYNC !== 'true') {
  console.error('Set ALLOW_DEMO_TEST_ACCOUNT_SYNC=true to confirm this demo/test setup step.');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL.');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const pool = require('../src/db/pool');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const roles = [
  ['role-staff-001', 'line_staff', 'Line Staff', 'Assigned queue/counter/service operator'],
  ['role-supervisor-001', 'supervisor', 'Supervisor', 'Section/branch supervisor — read-only operational view; sees branch targets'],
  ['role-mgr-001', 'manager', 'Manager', 'Branch manager for staff assignments and branch operations'],
  ['role-exec-001', 'executive', 'Executive', 'Business-wide executive dashboard and analytics access'],
  ['role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal Lyne operator for onboarding and support'],
];

const accounts = [
  {
    email: 'user@test.com',
    kind: 'user',
    id: 'usr-test-mobile',
    fullName: 'Shanique Powell',
  },
  {
    email: 'staff@test.com',
    kind: 'staff',
    id: 'stf-test-line',
    fullName: 'Marlon Chin',
    staffCode: 'TEST-STAFF',
    roleId: 'role-staff-001',
    businessId: 'biz-taj-001',
    branchId: 'br-taj-kgn',
    assignedServiceId: 'svc-taj-trn',
    counterId: 'ctr-taj-kgn-1',
  },
  {
    email: 'supervisor@test.com',
    kind: 'staff',
    id: 'staff-sup-taj-kgn',
    fullName: 'Paulette Grant',
    staffCode: 'SUP-KGN-01',
    roleId: 'role-supervisor-001',
    businessId: 'biz-taj-001',
    branchId: 'br-taj-kgn',
    assignedServiceId: null,
  },
  {
    email: 'manager@test.com',
    kind: 'staff',
    id: 'stf-test-manager',
    fullName: 'Andrea Salmon',
    staffCode: 'TEST-MANAGER',
    roleId: 'role-mgr-001',
    businessId: 'biz-taj-001',
    branchId: 'br-taj-kgn',
    assignedServiceId: null,
  },
  {
    email: 'executive@test.com',
    kind: 'staff',
    id: 'stf-test-executive',
    fullName: 'Everton Blake',
    staffCode: 'TEST-EXEC',
    roleId: 'role-exec-001',
    businessId: 'biz-taj-001',
    branchId: null,
    assignedServiceId: null,
  },
  {
    email: 'platform@test.com',
    kind: 'staff',
    id: 'stf-test-platform',
    fullName: 'Lyne Platform Admin',
    staffCode: 'TEST-PLATFORM',
    roleId: 'role-platform-admin-001',
    businessId: 'biz-taj-001',
    branchId: null,
    assignedServiceId: null,
  },

  /* ── PICA — every admin level ──────────────────────────────────────────
     The TAJ block above could only ever demo one sector. These exist so the
     government-revenue wording ("Customers", "Officers") can be shown on a
     tenant that is an actual procurement prospect, and so tenant isolation can
     be exercised by logging in as two different agencies rather than asserted. */
  {
    email: 'staff-pica@test.com',
    kind: 'staff',
    id: 'stf-test-pica-line',
    fullName: 'Kadeen Wright',
    staffCode: 'TEST-PICA-STAFF',
    roleId: 'role-staff-001',
    businessId: 'biz-pica-001',
    branchId: 'br-pica-kgn',
    assignedServiceId: 'svc-pica-new',
    counterId: 'ctr-pica-kgn-1',
  },
  {
    email: 'supervisor-pica@test.com',
    kind: 'staff',
    id: 'stf-test-pica-sup',
    fullName: 'Delroy McKenzie',
    staffCode: 'TEST-PICA-SUP',
    roleId: 'role-supervisor-001',
    businessId: 'biz-pica-001',
    branchId: 'br-pica-kgn',
    assignedServiceId: null,
  },
  {
    email: 'manager-pica@test.com',
    kind: 'staff',
    id: 'stf-test-pica-mgr',
    fullName: 'Marcia Hoilett',
    staffCode: 'TEST-PICA-MGR',
    roleId: 'role-mgr-001',
    businessId: 'biz-pica-001',
    branchId: 'br-pica-kgn',
    assignedServiceId: null,
  },
  {
    email: 'executive-pica@test.com',
    kind: 'staff',
    id: 'stf-test-pica-exec',
    fullName: 'Patrick Gordon',
    staffCode: 'TEST-PICA-EXEC',
    roleId: 'role-exec-001',
    businessId: 'biz-pica-001',
    branchId: null,
    assignedServiceId: null,
  },

  /* ── Community First — every admin level ───────────────────────────────
     The credit union is the other half of the sector story: the SAME screens
     have to read "Members" and "Loan Officers" here while reading "Customers"
     and "Officers" at PICA. Without a login on both, that is untestable. */
  {
    email: 'staff-creditunion@test.com',
    kind: 'staff',
    id: 'stf-test-cfcu-line',
    fullName: 'Tashana Reid',
    staffCode: 'TEST-CFCU-STAFF',
    roleId: 'role-staff-001',
    businessId: 'biz-cfcu-001',
    branchId: 'br-cfcu-hwt',
    assignedServiceId: 'svc-cfcu-member',
    counterId: 'ctr-cfcu-member-1',
  },
  {
    email: 'supervisor-creditunion@test.com',
    kind: 'staff',
    id: 'stf-test-cfcu-sup',
    fullName: 'Ricardo Bent',
    staffCode: 'TEST-CFCU-SUP',
    roleId: 'role-supervisor-001',
    businessId: 'biz-cfcu-001',
    branchId: 'br-cfcu-hwt',
    assignedServiceId: null,
  },
  {
    email: 'manager-creditunion@test.com',
    kind: 'staff',
    id: 'stf-test-cfcu-mgr',
    fullName: 'Suzette Clarke',
    staffCode: 'TEST-CFCU-MGR',
    roleId: 'role-mgr-001',
    businessId: 'biz-cfcu-001',
    branchId: 'br-cfcu-hwt',
    assignedServiceId: null,
  },
  {
    email: 'executive-creditunion@test.com',
    kind: 'staff',
    id: 'stf-test-cfcu-exec',
    fullName: 'Michael Aarons',
    staffCode: 'TEST-CFCU-EXEC',
    roleId: 'role-exec-001',
    businessId: 'biz-cfcu-001',
    branchId: null,
    assignedServiceId: null,
  },
];

const demoQueues = [
  ['q-taj-trn-today', 'br-taj-kgn', 'svc-taj-trn', 50],
  ['q-taj-pay-today', 'br-taj-kgn', 'svc-taj-pay', 30],
];

async function getAllSupabaseUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function assertDemoDataExists(connection) {
  const checks = [
    ['businesses', 'biz-taj-001'],
    ['branches', 'br-taj-kgn'],
    ['services', 'svc-taj-trn'],
    ['counters', 'ctr-taj-kgn-1'],
  ];

  for (const [table, id] of checks) {
    const [rows] = await connection.query(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) {
      throw new Error(
        `Demo record ${table}.${id} was not found. Load the demo seed data before syncing test accounts.`
      );
    }
  }
}

async function syncRoles(connection) {
  await connection.query(
    `INSERT INTO roles (id, name, label, description)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       label = VALUES(label),
       description = VALUES(description)`,
    [roles]
  );
}

/**
 * Make sure the demo services have a queue open today.
 *
 * The point is "a queue exists for this branch+service today", NOT "a queue with
 * this particular id exists". Those are different, and conflating them broke the
 * whole script: demo_active_seed.sql opens today's lines as q-taj-kgn-trn, while
 * the ids below are the older q-taj-trn-today. Both name the same
 * (branch, service) pair, so re-dating the second onto today collided with the
 * first on uk_queue_day (branch, service, date) — and because that fires after
 * the PRIMARY-key match, ON DUPLICATE KEY UPDATE could not absorb it. The sync
 * aborted before linking a single account.
 */
async function syncTodayQueues(connection) {
  for (const [id, branchId, serviceId, maxCapacity] of demoQueues) {
    const [existing] = await connection.query(
      `SELECT id FROM queues
        WHERE branch_id = ? AND service_id = ? AND queue_date = CURDATE()
        LIMIT 1`,
      [branchId, serviceId]
    );
    // Somebody already opened this line today (usually the demo seed). Leave it
    // alone — a second row for the same line is exactly what the key forbids.
    if (existing.length) continue;

    await connection.query(
      `INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
       VALUES (?, ?, ?, CURDATE(), ?, TRUE)
       ON DUPLICATE KEY UPDATE
         branch_id = VALUES(branch_id),
         service_id = VALUES(service_id),
         queue_date = VALUES(queue_date),
         max_capacity = VALUES(max_capacity),
         is_active = TRUE`,
      [id, branchId, serviceId, maxCapacity]
    );
  }
}

async function syncMobileUser(connection, account, supabaseUser) {
  await connection.query(
    `INSERT INTO users (id, supabase_uid, email, full_name)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       supabase_uid = VALUES(supabase_uid),
       full_name = VALUES(full_name),
       updated_at = NOW()`,
    [account.id, supabaseUser.id, account.email, account.fullName]
  );

  await connection.query(
    `INSERT INTO saved_businesses (user_id, business_id)
     VALUES (?, 'biz-cfcu-001'), (?, 'biz-taj-001'), (?, 'biz-pica-001'), (?, 'biz-nht-001')
     ON DUPLICATE KEY UPDATE saved_at = saved_at`,
    [account.id, account.id, account.id, account.id]
  );
}

async function syncStaff(connection, account, supabaseUser) {
  await connection.query(
    `INSERT INTO staff
       (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email, assigned_service_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE
       business_id = VALUES(business_id),
       branch_id = VALUES(branch_id),
       role_id = VALUES(role_id),
       supabase_uid = VALUES(supabase_uid),
       staff_code = VALUES(staff_code),
       full_name = VALUES(full_name),
       assigned_service_id = VALUES(assigned_service_id),
       is_active = TRUE,
       updated_at = NOW()`,
    [
      account.id,
      account.businessId,
      account.branchId,
      account.roleId,
      supabaseUser.id,
      account.staffCode,
      account.fullName,
      account.email,
      account.assignedServiceId,
    ]
  );

  if (account.counterId) {
    /* staff_assignments is keyed (staff_id, assignment_date) — one desk per
       person per day. Two things used to break here:

       1. The row id was the hard-coded literal 'asgn-test-line-current', so
          every counter-holding account fought over a single row. That was
          invisible while TAJ was the only tenant with one; it is not now.
       2. The insert assumed no other assignment existed for that person today.
          The demo seed makes one, so the natural key fired before the primary
          key and ON DUPLICATE KEY UPDATE could not catch it — aborting the sync.

       Seat by the natural key instead: move whoever is already assigned today,
       otherwise create the row. */
    const [seated] = await connection.query(
      'SELECT id FROM staff_assignments WHERE staff_id = ? AND assignment_date = CURDATE() LIMIT 1',
      [account.id]
    );

    if (seated.length) {
      await connection.query(
        `UPDATE staff_assignments
            SET counter_id = ?, shift_start = '08:30:00', shift_end = '16:30:00'
          WHERE id = ?`,
        [account.counterId, seated[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO staff_assignments
           (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by)
         VALUES (?, ?, ?, CURDATE(), '08:30:00', '16:30:00', NULL)`,
        [`asgn-${account.id}-current`, account.id, account.counterId]
      );
    }
  }
}

async function main() {
  const supabaseUsers = await getAllSupabaseUsers();
  const usersByEmail = new Map(supabaseUsers.map((user) => [user.email?.toLowerCase(), user]));

  for (const account of accounts) {
    if (!usersByEmail.has(account.email)) {
      throw new Error(`Supabase Auth user ${account.email} was not found. Create it first, then rerun this script.`);
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await refreshDemoData(connection);
    await assertDemoDataExists(connection);
    await syncRoles(connection);
    await syncTodayQueues(connection);

    for (const account of accounts) {
      const supabaseUser = usersByEmail.get(account.email);
      if (account.kind === 'user') {
        await syncMobileUser(connection, account, supabaseUser);
      } else {
        await syncStaff(connection, account, supabaseUser);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }

  for (const account of accounts) {
    const role = account.kind === 'user' ? 'mobile user' : account.roleId.replace('role-', '').replace('-001', '');
    console.log(`Linked ${account.email} as ${role}.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
