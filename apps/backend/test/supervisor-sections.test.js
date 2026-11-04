/**
 * supervisor-sections.test.js — a supervisor runs a section, not the branch
 * (migration 043).
 *
 * The promises: a supervisor with a section is limited to its services, a
 * supervisor without one keeps the whole branch (nothing changes until a
 * section is assigned), and nobody else is ever narrowed by it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { sectionServiceIds, pushSectionScope, assertSectionAccess } = require('../src/middleware/tenantAccess');

const as = (role, extra = {}) => ({ dbStaff: { role_name: role, branch_id: 'br-1', ...extra } });

test('a supervisor with a section is limited to its services', () => {
  const req = as('supervisor', { section_service_ids: ['svc-teller', 'svc-card'] });
  assert.deepEqual(sectionServiceIds(req), ['svc-teller', 'svc-card']);
  const conditions = []; const params = [];
  pushSectionScope(req, conditions, params, 'w.service_id');
  assert.deepEqual(conditions, ['w.service_id IN (?)']);
  assert.deepEqual(params, [['svc-teller', 'svc-card']]);
  assert.equal(assertSectionAccess(req, 'svc-teller'), true);
  assert.equal(assertSectionAccess(req, 'svc-loans'), false);
});

test('a supervisor without a section keeps the whole branch', () => {
  for (const req of [as('supervisor'), as('supervisor', { section_service_ids: [] })]) {
    assert.equal(sectionServiceIds(req), null);
    const conditions = []; const params = [];
    pushSectionScope(req, conditions, params, 'w.service_id');
    assert.deepEqual(conditions, []);
    assert.equal(assertSectionAccess(req, 'svc-anything'), true);
  }
});

test('managers, executives and desk staff are never narrowed by a section', () => {
  for (const role of ['manager', 'executive', 'line_staff', 'kiosk_clerk']) {
    const req = as(role, { section_service_ids: ['svc-teller'] });
    assert.equal(sectionServiceIds(req), null, role);
    assert.equal(assertSectionAccess(req, 'svc-loans'), true, role);
  }
});
