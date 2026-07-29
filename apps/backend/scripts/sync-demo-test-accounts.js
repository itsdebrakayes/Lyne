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
  ['role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal QMe operator for onboarding and support'],
];

const accounts = [
  {
    email: 'user@test.com',
    kind: 'user',
    id: 'usr-test-mobile',
    fullName: 'Demo Mobile User',
  },
  {
    email: 'staff@test.com',
    kind: 'staff',
    id: 'stf-test-line',
    fullName: 'Demo Line Staff',
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
    fullName: 'Demo Supervisor',
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
    fullName: 'Demo Branch Manager',
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
    fullName: 'Demo Executive',
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
    fullName: 'Demo Platform Admin',
    staffCode: 'TEST-PLATFORM',
    roleId: 'role-platform-admin-001',
    businessId: 'biz-taj-001',
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

async function syncTodayQueues(connection) {
  for (const [id, branchId, serviceId, maxCapacity] of demoQueues) {
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
     VALUES (?, 'biz-taj-001'), (?, 'biz-pica-001'), (?, 'biz-nht-001')
     ON DUPLICATE KEY UPDATE saved_at = saved_at`,
    [account.id, account.id, account.id]
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
    await connection.query(
      `INSERT INTO staff_assignments
         (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by)
       VALUES (?, ?, ?, CURDATE(), '08:30:00', '16:30:00', ?)
       ON DUPLICATE KEY UPDATE
         counter_id = VALUES(counter_id),
         assignment_date = VALUES(assignment_date),
         shift_start = VALUES(shift_start),
         shift_end = VALUES(shift_end),
         created_by = VALUES(created_by)`,
      ['asgn-test-line-current', account.id, account.counterId, null]
    );
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
