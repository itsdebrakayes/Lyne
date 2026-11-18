#!/usr/bin/env node
/**
 * seed-showcase-history.js — writes the SQL for Lignum Bank's past visits.
 *
 *   node scripts/seed-showcase-history.js > lignum-history.sql
 *
 * Lignum Bank is a fictional showcase organisation in the live app. On the
 * owner's say-so (November 2026) it also carries invented past visits, so its
 * dashboards, Busy Times, forecasts and reports have something to show when the
 * bank is demonstrated on production.
 *
 * Unlike the demo seeds this may run on production, because everything in it is
 * invented and stays inside Lignum:
 *   - staff rows with NO login: supabase_uid and password_hash stay empty, and
 *     staff can only sign in through supabase_uid, so nobody can sign in as one;
 *   - walk-in visits with no account and no name, plus thirty invented clients
 *     (fictional names, reserved .example addresses, NO login) so Client Cases
 *     has someone in it (owner's say-so, 18 Nov 2026);
 *   - every visit, shift and sitting id starts "lgbv-", and every staff id "stf-lgb-".
 *
 * It connects to nothing: it prints SQL, which is loaded as one transaction.
 * Rerunning replaces every "lgbv-" row, so running it again the day before a demo
 * brings the history up to yesterday. Today is left alone: it belongs to the live
 * lines. A line the server already opened for a past day is reused rather than
 * duplicated.
 *
 * Afterwards rebuild the daily rollup for Lignum:
 *   refreshAnalyticsSummaries(92, { businessId: 'biz-lgb-001' })
 */
const DAYS = 90;
const BIZ = 'biz-lgb-001';

function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAFF = [
  ['stf-lgb-exec', null, 'role-exec-001', 'LGB-EX1', 'Lorraine Gordon', 'lorraine', null],
  ['stf-lgb-hwt-mgr', 'br-lgb-hwt', 'role-mgr-001', 'LGB-BM1', 'Dwayne Pottinger', 'dwayne', null],
  ['stf-lgb-hwt-sup', 'br-lgb-hwt', 'role-supervisor-001', 'LGB-SV1', 'Kimberley Hylton', 'kimberley', null],
  ['stf-lgb-hwt-tel1', 'br-lgb-hwt', 'role-staff-001', 'LGB-T01', 'Shauna Edwards', 'shauna', 'svc-lgb-teller'],
  ['stf-lgb-hwt-tel2', 'br-lgb-hwt', 'role-staff-001', 'LGB-T02', 'Omar Francis', 'omar', 'svc-lgb-teller'],
  ['stf-lgb-hwt-tel3', 'br-lgb-hwt', 'role-staff-001', 'LGB-T03', 'Jermaine Wright', 'jermaine', 'svc-lgb-teller'],
  ['stf-lgb-hwt-pbo', 'br-lgb-hwt', 'role-staff-001', 'LGB-P01', 'Natalie Brooks', 'natalie', 'svc-lgb-acct'],
  ['stf-lgb-hwt-pbo2', 'br-lgb-hwt', 'role-staff-001', 'LGB-P02', 'Kadian Stewart', 'kadian', 'svc-lgb-acct'],
  ['stf-lgb-hwt-lend', 'br-lgb-hwt', 'role-staff-001', 'LGB-L01', 'Christopher Lyn', 'christopher', 'svc-lgb-loan'],
  ['stf-lgb-hwt-card', 'br-lgb-hwt', 'role-staff-001', 'LGB-C01', 'Tamika Reid', 'tamika', 'svc-lgb-card'],
  ['stf-lgb-nkg-mgr', 'br-lgb-nkg', 'role-mgr-001', 'LGB-BM2', 'Paulette Grant', 'paulette', null],
  ['stf-lgb-nkg-tel1', 'br-lgb-nkg', 'role-staff-001', 'LGB-T11', 'Javon Thompson', 'javon', 'svc-lgb-teller'],
  ['stf-lgb-nkg-tel2', 'br-lgb-nkg', 'role-staff-001', 'LGB-T12', 'Kerry-Ann Campbell', 'kerryann', 'svc-lgb-teller'],
  ['stf-lgb-nkg-tel3', 'br-lgb-nkg', 'role-staff-001', 'LGB-T13', 'Dane Richards', 'dane', 'svc-lgb-teller'],
  ['stf-lgb-nkg-pbo', 'br-lgb-nkg', 'role-staff-001', 'LGB-P11', 'Sheldon Morgan', 'sheldon', 'svc-lgb-acct'],
  ['stf-lgb-nkg-biz', 'br-lgb-nkg', 'role-staff-001', 'LGB-B11', 'Renee Clarke', 'renee', 'svc-lgb-biz'],
  ['stf-lgb-nkg-lend', 'br-lgb-nkg', 'role-staff-001', 'LGB-L11', 'Garfield Bailey', 'garfield', 'svc-lgb-loan'],
  ['stf-lgb-mob-mgr', 'br-lgb-mob', 'role-mgr-001', 'LGB-BM3', 'Andrea Walters', 'andrea', null],
  ['stf-lgb-mob-tel1', 'br-lgb-mob', 'role-staff-001', 'LGB-T21', 'Ricardo Henry', 'ricardo', 'svc-lgb-teller'],
  ['stf-lgb-mob-pbo', 'br-lgb-mob', 'role-staff-001', 'LGB-P21', 'Simone Barrett', 'simone', 'svc-lgb-acct'],
];

/* Daily arrivals on an ordinary weekday, per desk, and who serves there. */
/* The presenter desk logins (lignum.officer and lignum.officer2, staff rows
   stf-lgbx-off1 / -off2, created with their Supabase logins on production) sit
   at Teller 1 and the account-opening desk, so their History has real days.
   Their staff rows are NOT written here: this script never creates a login. */
const PRESENTER_TELLER = 'stf-lgbx-off1';
const PRESENTER_ACCT = 'stf-lgbx-off2';
const DESKS = [
  { branch: 'br-lgb-hwt', service: 'svc-lgb-teller', prefix: 'TEL', daily: 140, mins: 5, staff: [[PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1'], ['stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-2'], ['stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-3']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-acct', prefix: 'ACC', daily: 18, mins: 32, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct'], [PRESENTER_ACCT, 'ctr-lgb-hwt-acct']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-card', prefix: 'CRD', daily: 22, mins: 12, staff: [['stf-lgb-hwt-card', 'ctr-lgb-hwt-card']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-loan', prefix: 'LON', daily: 8, mins: 38, staff: [['stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-enq', prefix: 'ENQ', daily: 25, mins: 14, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-teller', prefix: 'TEL', daily: 95, mins: 5, staff: [['stf-lgb-nkg-tel3', 'ctr-lgb-nkg-tel-1'], ['stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-acct', prefix: 'ACC', daily: 10, mins: 32, staff: [['stf-lgb-nkg-pbo', 'ctr-lgb-nkg-acct']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-loan', prefix: 'LON', daily: 5, mins: 38, staff: [['stf-lgb-nkg-lend', 'ctr-lgb-nkg-loan']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-biz', prefix: 'BIZ', daily: 20, mins: 18, staff: [['stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-teller', prefix: 'TEL', daily: 45, mins: 5, staff: [['stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-acct', prefix: 'ACC', daily: 6, mins: 32, staff: [['stf-lgb-mob-pbo', 'ctr-lgb-mob-acct']] },
];

/* Clients (owner's say-so, 18 Nov 2026): the same invented people the demo
   sandbox uses, so Client Cases, the Customers directory and a client's visit
   history have someone in them. Thirty fictional names with reserved .example
   addresses and NO login (users.supabase_uid stays empty, so nobody can sign in
   as one). Their visits carry the stories a bank recognises: sent home three
   times for documents, a pensioner whose payment is held, a card dispute bounced
   between desks, a loan applicant, a returnee re-verifying identity, repeated
   remittance outages. Visit ids start "lgbv-c-", so a rerun replaces them. */
/* Invented clients (fictional; reserved .example addresses; no login). */
const CLIENTS = [
  ['usr-lgb-c01', 'kerry-ann.thompson@client.lignum.example', 'Kerry-Ann Thompson', '876-555-4001'],
  ['usr-lgb-c02', 'beverley.walters@client.lignum.example', 'Beverley Walters', '876-555-4002'],
  ['usr-lgb-c03', 'oneil.bryan@client.lignum.example', 'Oneil Bryan', '876-555-4003'],
  ['usr-lgb-c04', 'tamara.lewis@client.lignum.example', 'Tamara Lewis', '876-555-4004'],
  ['usr-lgb-c05', 'winston.clarke@client.lignum.example', 'Winston Clarke', '876-555-4005'],
  ['usr-lgb-c06', 'shernette.palmer@client.lignum.example', 'Shernette Palmer', '876-555-4006'],
  ['usr-lgb-c07', 'desmond.reid@client.lignum.example', 'Desmond Reid', '876-555-4007'],
  ['usr-lgb-c08', 'andre.gayle@client.lignum.example', 'Andre Gayle', '876-555-4008'],
  ['usr-lgb-c09', 'nadia.blake@client.lignum.example', 'Nadia Blake', '876-555-4009'],
  ['usr-lgb-c10', 'kemar.wisdom@client.lignum.example', 'Kemar Wisdom', '876-555-4010'],
  ['usr-lgb-c11', 'simone.case@client.lignum.example', 'Simone Case', '876-555-4011'],
  ['usr-lgb-c12', 'racquel.dixon@client.lignum.example', 'Racquel Dixon', '876-555-4012'],
  ['usr-lgb-c13', 'garfield.mckenzie@client.lignum.example', 'Garfield McKenzie', '876-555-4013'],
  ['usr-lgb-c14', 'sherika.morgan@client.lignum.example', 'Sherika Morgan', '876-555-4014'],
  ['usr-lgb-c15', 'dale.robinson@client.lignum.example', 'Dale Robinson', '876-555-4015'],
  ['usr-lgb-c16', 'marsha.stewart@client.lignum.example', 'Marsha Stewart', '876-555-4016'],
  ['usr-lgb-c17', 'kevin.williams@client.lignum.example', 'Kevin Williams', '876-555-4017'],
  ['usr-lgb-c18', 'tanya.brown@client.lignum.example', 'Tanya Brown', '876-555-4018'],
  ['usr-lgb-c19', 'patrice.hall@client.lignum.example', 'Patrice Hall', '876-555-4019'],
  ['usr-lgb-c20', 'leroy.smith@client.lignum.example', 'Leroy Smith', '876-555-4020'],
  ['usr-lgb-c21', 'nicola.barrett@client.lignum.example', 'Nicola Barrett', '876-555-4021'],
  ['usr-lgb-c22', 'courtney.daley@client.lignum.example', 'Courtney Daley', '876-555-4022'],
  ['usr-lgb-c23', 'yvonne.ennis@client.lignum.example', 'Yvonne Ennis', '876-555-4023'],
  ['usr-lgb-c24', 'errol.bailey@client.lignum.example', 'Errol Bailey', '876-555-4024'],
  ['usr-lgb-c25', 'donna.wright@client.lignum.example', 'Donna Wright', '876-555-4025'],
  ['usr-lgb-c26', 'kirk.allen@client.lignum.example', 'Kirk Allen', '876-555-4026'],
  ['usr-lgb-c27', 'wayne.henry@client.lignum.example', 'Wayne Henry', '876-555-4027'],
  ['usr-lgb-c28', 'janelle.grant@client.lignum.example', 'Janelle Grant', '876-555-4028'],
  ['usr-lgb-c29', 'ricardo.spence@client.lignum.example', 'Ricardo Spence', '876-555-4029'],
  ['usr-lgb-c30', 'monique.francis@client.lignum.example', 'Monique Francis', '876-555-4030'],
];
/* [n, client, branch, service, prefix, daysAgo, 'HH:MM', waitMin, serviceMin, status, closedReason, note, staff, counter, channel, code, position] */
const CLIENT_VISITS = [
  [1, 'usr-lgb-c18', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 26, '11:05', 10, 3, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'app', 'KWMKH3', 201],
  [2, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 26, '11:25', 17, 21, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'walk_in', 'FGWQN6', 202],
  [3, 'usr-lgb-c20', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 26, '14:05', 32, 43, 'served', null, null, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'walk_in', 'UP9H77', 203],
  [4, 'usr-lgb-c08', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 25, '09:25', 26, 8, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'QN3YGE', 204],
  [5, 'usr-lgb-c30', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 24, '12:25', 6, 10, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2', 'app', 'RQVFJF', 205],
  [6, 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 24, '13:15', 10, 40, 'served', 'wrong_documents', 'Only two of the three payslips.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'DWAP6U', 206],
  [7, 'usr-lgb-c11', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 24, '13:15', 14, 6, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', 'MRTRW6', 207],
  [8, 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 23, '11:50', 47, 7, 'no_show', null, null, null, null, 'app', '6JYHWT', 208],
  [9, 'usr-lgb-c09', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 23, '14:40', 22, 3, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'kiosk', '7CU4MW', 209],
  [10, 'usr-lgb-c12', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 22, '10:05', 42, 10, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', 'WFXGJX', 210],
  [11, 'usr-lgb-c30', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 22, '12:15', 12, 9, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'EATNP4', 211],
  [12, 'usr-lgb-c14', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 22, '14:05', 32, 20, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'walk_in', 'KM7UPE', 212],
  [13, 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 22, '14:50', 31, 14, 'served', 'wrong_documents', 'Overseas address not accepted as proof of address.', PRESENTER_ACCT, 'ctr-lgb-hwt-enq', 'kiosk', 'KYUMFF', 213],
  [14, 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 21, '11:05', 20, 2, 'served', null, null, PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1', 'app', 'NAK7NE', 214],
  [15, 'usr-lgb-c10', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 20, '09:15', 33, 10, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'walk_in', 'V3Y9NY', 215],
  [16, 'usr-lgb-c27', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 20, '10:25', 18, 30, 'no_show', null, null, null, null, 'kiosk', '76TAX9', 216],
  [17, 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 20, '11:05', 8, 29, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'UWY4F9', 217],
  [18, 'usr-lgb-c14', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 20, '11:50', 17, 17, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-biz', 'app', 'GNTRAK', 218],
  [19, 'usr-lgb-c24', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 20, '12:50', 28, 42, 'served', null, null, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'XEUHXA', 219],
  [20, 'usr-lgb-c20', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 19, '14:25', 29, 33, 'no_show', null, null, null, null, 'walk_in', 'JRCW7T', 220],
  [21, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 19, '14:50', 7, 17, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'walk_in', 'PC7E76', 221],
  [22, 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 18, '10:50', 22, 10, 'served', 'referred_elsewhere', 'Sent to Account Enquiries to raise the dispute.', 'stf-lgb-hwt-card', 'ctr-lgb-hwt-card', 'app', 'YTYTMV', 222],
  [23, 'usr-lgb-c21', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 17, '10:15', 39, 31, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'walk_in', 'ERRV4V', 223],
  [24, 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 17, '12:05', 11, 30, 'no_show', null, null, null, null, 'app', '9UD4RX', 224],
  [25, 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 17, '12:40', 40, 44, 'served', 'wrong_documents', 'Job letter was older than 30 days.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'MAE4JD', 225],
  [26, 'usr-lgb-c19', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 17, '13:50', 40, 7, 'served', null, null, PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1', 'walk_in', 'AYKEFV', 226],
  [27, 'usr-lgb-c26', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 17, '14:50', 33, 14, 'served', null, null, 'stf-lgb-hwt-card', 'ctr-lgb-hwt-card', 'kiosk', 'FDYYG7', 227],
  [28, 'usr-lgb-c24', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 16, '12:50', 20, 34, 'served', null, null, PRESENTER_ACCT, 'ctr-lgb-hwt-acct', 'app', 'Q4RKWN', 228],
  [29, 'usr-lgb-c16', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 16, '13:25', 25, 29, 'served', 'wrong_documents', 'Proof of address was older than three months.', PRESENTER_ACCT, 'ctr-lgb-hwt-acct', 'kiosk', '6CVPG9', 229],
  [30, 'usr-lgb-c28', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 16, '14:50', 15, 44, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'walk_in', 'TQHUNW', 230],
  [31, 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 15, '09:40', 16, 16, 'served', 'referred_elsewhere', 'Sent to Personal Banking to re-verify identity.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq', 'app', 'JEWQVX', 231],
  [32, 'usr-lgb-c30', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 15, '10:15', 42, 44, 'served', null, null, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'JH49A9', 232],
  [33, 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 15, '11:05', 21, 35, 'served', 'wrong_documents', 'Proof of address was older than three months.', PRESENTER_ACCT, 'ctr-lgb-hwt-acct', 'walk_in', '9KN76D', 233],
  [34, 'usr-lgb-c19', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 15, '11:05', 18, 5, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', 'MTFK6F', 234],
  [35, 'usr-lgb-c16', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 15, '11:25', 26, 36, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'DPC4P6', 235],
  [36, 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 15, '12:25', 9, 12, 'served', 'wrong_service', 'Disputes are handled at Card Services.', PRESENTER_ACCT, 'ctr-lgb-hwt-enq', 'app', 'TCEKP3', 236],
  [37, 'usr-lgb-c13', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 14, '12:05', 34, 42, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'FRDE6V', 237],
  [38, 'usr-lgb-c11', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 13, '10:25', 15, 4, 'served', null, null, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'app', 'PJNQCT', 238],
  [39, 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 13, '12:25', 37, 29, 'served', 'wrong_documents', 'Client did not have a TRN card or copy.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'kiosk', 'FNXNMN', 239],
  [40, 'usr-lgb-c09', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 13, '14:05', 40, 31, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'walk_in', 'RTUCH7', 240],
  [41, 'usr-lgb-c16', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 12, '10:15', 37, 6, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'RC3XG9', 241],
  [42, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 12, '10:25', 15, 36, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'XMJY9U', 242],
  [43, 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 12, '13:15', 48, 4, 'served', null, null, PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1', 'app', 'YFQYTP', 243],
  [44, 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 11, '11:50', 44, 12, 'served', 'system_issue', 'Dispute system unavailable.', 'stf-lgb-hwt-card', 'ctr-lgb-hwt-card', 'kiosk', 'HW6GRX', 244],
  [45, 'usr-lgb-c28', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 10, '10:15', 38, 35, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'app', '7M933M', 245],
  [46, 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 10, '12:15', 42, 6, 'served', 'system_issue', 'Wire transfer system unavailable.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'app', 'HNXHNP', 246],
  [47, 'usr-lgb-c08', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 10, '13:25', 24, 37, 'served', null, null, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'walk_in', 'M9HFTP', 247],
  [48, 'usr-lgb-c17', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 10, '14:15', 11, 17, 'served', null, null, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'kiosk', 'RVXNYY', 248],
  [49, 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 9, '10:15', 26, 2, 'served', null, null, PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1', 'kiosk', 'NRQ6QW', 249],
  [50, 'usr-lgb-c26', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 9, '10:40', 27, 32, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'RPKCXQ', 250],
  [51, 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 9, '10:50', 20, 6, 'served', 'system_issue', 'Wire transfer system unavailable.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2', 'app', '3UVQC6', 251],
  [52, 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 9, '12:05', 38, 37, 'left', 'customer_left', null, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'QFYJM3', 252],
  [53, 'usr-lgb-c23', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 9, '13:15', 33, 35, 'no_show', null, null, null, null, 'walk_in', 'HHFY3J', 253],
  [54, 'usr-lgb-c18', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 9, '13:40', 6, 30, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', '4D3JPE', 254],
  [55, 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 8, '12:05', 16, 29, 'served', 'wrong_documents', 'Passport expired; needs a current photo ID.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'JYCJJW', 255],
  [56, 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 8, '12:25', 27, 12, 'served', 'referred_elsewhere', 'Escalated to the card disputes team.', 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'app', '7PEUWT', 256],
  [57, 'usr-lgb-c09', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 8, '13:40', 37, 31, 'no_show', null, null, null, null, 'kiosk', 'C4C9WU', 257],
  [58, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 7, '10:40', 23, 6, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'HQDTME', 258],
  [59, 'usr-lgb-c25', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 7, '13:40', 36, 35, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', 'MVNNKX', 259],
  [60, 'usr-lgb-c25', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 6, '09:15', 35, 5, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'JN3DXW', 260],
  [61, 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 6, '09:50', 39, 10, 'served', 'system_issue', 'Pension payment not yet credited to the account.', PRESENTER_TELLER, 'ctr-lgb-hwt-tel-1', 'app', 'GXFFXM', 261],
  [62, 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 6, '10:05', 20, 35, 'served', 'wrong_documents', 'Job letter was not on company letterhead.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'XKM3PT', 262],
  [63, 'usr-lgb-c08', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 6, '10:40', 41, 19, 'served', null, null, PRESENTER_ACCT, 'ctr-lgb-hwt-enq', 'walk_in', '4FFECJ', 263],
  [64, 'usr-lgb-c13', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 6, '10:50', 38, 6, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', 'WEKV6F', 264],
  [65, 'usr-lgb-c28', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 6, '14:05', 24, 4, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', '4HRYMC', 265],
  [66, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 5, '09:15', 29, 15, 'served', 'wrong_documents', 'Board resolution for the new signatory was not signed.', 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'app', 'AMQ6HD', 266],
  [67, 'usr-lgb-c11', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 5, '09:40', 12, 8, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'kiosk', 'NN6W6U', 267],
  [68, 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 5, '12:50', 15, 35, 'served', 'wrong_documents', 'Asked to bring certified copies of documents already uploaded online.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'walk_in', 'YPCQAA', 268],
  [69, 'usr-lgb-c21', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 5, '13:40', 7, 23, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'walk_in', 'HF3QKN', 269],
  [70, 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 4, '10:15', 43, 3, 'served', 'referred_elsewhere', 'Referred to the Accountant General about the held payment.', 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'app', 'DX7QNP', 270],
  [71, 'usr-lgb-c20', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 4, '10:50', 33, 16, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'walk_in', 'GUW7R4', 271],
  [72, 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 4, '11:05', 12, 41, 'served', 'wrong_documents', 'Proof of address was in her spouse’s name.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'kiosk', 'VPXCV7', 272],
  [73, 'usr-lgb-c22', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 4, '14:15', 20, 15, 'served', null, null, PRESENTER_ACCT, 'ctr-lgb-hwt-enq', 'app', 'HNJUWE', 273],
  [74, 'usr-lgb-c21', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 4, '14:40', 32, 5, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'walk_in', 'JJHQPE', 274],
  [75, 'usr-lgb-c25', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 3, '09:50', 6, 30, 'served', null, null, PRESENTER_ACCT, 'ctr-lgb-hwt-acct', 'app', 'UJYTQ9', 275],
  [76, 'usr-lgb-c24', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 3, '11:25', 31, 24, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-biz', 'kiosk', 'JVM67C', 276],
  [77, 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 3, '13:25', 33, 16, 'served', null, null, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'kiosk', 'M66U9J', 277],
  [78, 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 3, '14:40', 44, 8, 'served', 'system_issue', 'Remittance could not be released; system down.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'AKNCRV', 278],
  [79, 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 2, '09:15', 23, 30, 'served', null, null, PRESENTER_ACCT, 'ctr-lgb-hwt-acct', 'walk_in', 'FACVP4', 279],
  [80, 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 2, '10:15', 12, 8, 'served', null, null, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'kiosk', 'XAJY9Y', 280],
  [81, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 2, '11:25', 45, 6, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2', 'app', 'XMDC6D', 281],
  [82, 'usr-lgb-c23', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 2, '11:50', 38, 32, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', 'J3CVRU', 282],
  [83, 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 2, '12:40', 19, 5, 'served', 'system_issue', 'Payment still showing as pending.', 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', '3HRM74', 283],
  [84, 'usr-lgb-c27', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 2, '12:40', 44, 44, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'kiosk', 'AXFURP', 284],
  [85, 'usr-lgb-c09', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 1, '09:05', 40, 14, 'no_show', null, null, null, null, 'walk_in', 'PYYTYU', 285],
  [86, 'usr-lgb-c15', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 1, '10:40', 14, 11, 'served', null, null, 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq', 'app', '9ETXQW', 286],
  [87, 'usr-lgb-c27', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 1, '10:40', 11, 37, 'served', null, null, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'kiosk', 'WJ4GKD', 287],
  [88, 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 1, '11:50', 27, 16, 'served', null, null, 'stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz', 'app', 'DFEEQ7', 288],
  [89, 'usr-lgb-c20', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 1, '12:40', 35, 4, 'served', null, null, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', '7CT69T', 289],
  [90, 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 1, '13:15', 47, 7, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2', 'kiosk', '9UFGAY', 290],
  [91, 'usr-lgb-c15', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 1, '14:05', 45, 37, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'RPGG9H', 291],
  [92, 'usr-lgb-c23', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 1, '14:15', 36, 36, 'served', null, null, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'kiosk', 'HWDHYN', 292],
];

/* Share of the day's arrivals by opening hour. Lunch is the peak. */
const HOURS_STD = { 8: 0.07, 9: 0.13, 10: 0.17, 11: 0.19, 12: 0.22, 13: 0.15, 14: 0.07 };
const HOURS_HWT = { 8: 0.06, 9: 0.11, 10: 0.15, 11: 0.17, 12: 0.2, 13: 0.14, 14: 0.1, 15: 0.07 };

function dayFactor(d) {
  const dow = d.getDay();
  let f = dow === 5 ? 1.25 : dow === 1 ? 1.15 : 1;
  const dom = d.getDate();
  if (dom >= 24 && dom <= 26) f *= 1.8; // payday
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (dom >= last - 2) f *= 1.6; // month-end
  return f;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dt = (d) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
/* Jamaican holidays as observed: the bank is closed, so no visits. */
const HOLIDAYS = new Set(['2026-08-06', '2026-10-19', '2026-12-25', '2026-12-26', '2027-01-01', '2027-02-10']);
const ALPH = 'ACDEFGHJKMNPQRTUVWXY34679';
const sql = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const out = (s) => process.stdout.write(`${s}\n`);

function insert(table, cols, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    out(`INSERT INTO ${table} (${cols.join(', ')}) VALUES`);
    out(`${rows.slice(i, i + chunk).map((r) => `(${r.map(sql).join(',')})`).join(',\n')};`);
  }
}

function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rand = mulberry32(Number(ymd(today).replace(/-/g, '')));
  const queues = []; const tickets = []; const waits = []; const SHIFTS = []; const SITTINGS = [];
  let n = 0;

  for (let back = DAYS; back >= 1; back -= 1) {
    const day = new Date(today); day.setDate(day.getDate() - back);
    const dow = day.getDay();
    if (dow === 0 || dow === 6 || HOLIDAYS.has(ymd(day))) continue;
    const factor = dayFactor(day);
    const stamp = ymd(day).replace(/-/g, '');

    for (const desk of DESKS) {
      const queueId = `lgbv-q-${desk.branch.slice(7)}-${desk.service.slice(8)}-${stamp}`;
      queues.push([queueId, desk.branch, desk.service, ymd(day), 400, 0]);
      const hours = desk.branch === 'br-lgb-hwt' ? HOURS_HWT : HOURS_STD;
      const total = Math.round(desk.daily * factor * (0.85 + rand() * 0.3));
      let pos = 0;
      const codes = new Set();
      for (const [hourStr, share] of Object.entries(hours)) {
        const hour = Number(hourStr);
        const arrivals = Math.round(total * share);
        // Waits grow with how busy that hour is against the desk's capacity.
        const load = (arrivals * desk.mins) / (60 * desk.staff.length);
        for (let i = 0; i < arrivals; i += 1) {
          n += 1; pos += 1;
          const minute = hour === 8 ? 30 + Math.floor(rand() * 30) : Math.floor(rand() * 60);
          const joined = new Date(day); joined.setHours(hour, minute, Math.floor(rand() * 60), 0);
          const wait = Math.max(1, Math.round(load * 9 * (0.6 + rand() * 0.9) + rand() * 4));
          const svcMin = Math.max(2, Math.round(desk.mins * (0.7 + rand() * 0.7)));
          const r = rand();
          const status = r < 0.05 ? 'no_show' : r < 0.08 ? 'left' : 'served';
          const [staff, counter] = desk.staff[Math.floor(rand() * desk.staff.length)];
          const called = new Date(joined.getTime() + wait * 60000);
          const started = status === 'no_show' ? null : new Date(called.getTime() + 60000);
          const done = new Date(called.getTime() + (status === 'served' ? svcMin + 1 : status === 'left' ? 3 : 5) * 60000);
          const c = rand();
          const channel = c < 0.35 ? 'app' : c < 0.8 ? 'walk_in' : 'kiosk';
          let code;
          do { code = Array.from({ length: 6 }, () => ALPH[Math.floor(rand() * ALPH.length)]).join(''); } while (codes.has(code));
          codes.add(code);
          const id = `lgbv-${stamp}-${n}`;
          tickets.push([id, queueId, `${desk.prefix}-${String(pos).padStart(3, '0')}`, code, 3000 + pos, status, wait,
            dt(joined), dt(called), started ? dt(started) : null, dt(done), channel,
            status === 'no_show' ? null : staff, status === 'no_show' ? null : counter,
            status === 'left' ? 'customer_left' : null]);
          waits.push([id, id, BIZ, desk.branch, desk.service, ymd(day), dow, hour, day.getMonth() + 1,
            wait, status === 'served' ? svcMin : null, status, channel, desk.staff.length,
            Math.max(0, Math.round(load * 3 + rand() * 4)), desk.staff.length]);
        }
      }
    }

    /* The day's shifts and who sat where, so a past period has staffed hours and
       open counters. */
    const seenToday = new Map();
    for (const desk of DESKS) {
      for (const [staff, counter] of desk.staff) {
        /* Someone on two desks spends the afternoon at the second. */
        if (seenToday.has(staff)) { SITTINGS[seenToday.get(staff)][1] = counter; continue; }
        seenToday.set(staff, SITTINGS.length + 1);
        const closeHour = desk.branch === 'br-lgb-hwt' ? [16, 5] : [14, 35];
        const at = (h, m) => { const d = new Date(day); d.setHours(h, m + Math.floor(rand() * 6), 0, 0); return dt(d); };
        const key = `${stamp}-${staff.slice(4)}`;
        const [start, breakFrom, breakTo, end] = [at(8, 15), at(12, 0), at(12, 45), at(...closeHour)];
        SHIFTS.push([`lgbv-s-${key}`, staff, desk.branch, counter, start, end, 2700]);
        SITTINGS.push([`lgbv-a-${key}`, counter, staff, `lgbv-s-${key}`, start, breakFrom, 'break']);
        SITTINGS.push([`lgbv-b-${key}`, counter, staff, `lgbv-s-${key}`, breakTo, end, 'clock_out']);
      }
    }
  }

  /* The clients' visits, on the days they fall (a Sunday moves to Saturday). */
  const clientTickets = [];
  const queueIds = new Set(queues.map((q) => q[0]));
  for (const [num, user, branch, service, prefix, ago, hhmm, wait, svc, status, reason, note, staff, counter, channel, code, pos] of CLIENT_VISITS) {
    const day = new Date(today); day.setDate(day.getDate() - ago);
    if (day.getDay() === 0) day.setDate(day.getDate() - 1);
    const stamp = ymd(day).replace(/-/g, '');
    const queueId = `lgbv-q-${branch.slice(7)}-${service.slice(8)}-${stamp}`;
    if (!queueIds.has(queueId)) { queueIds.add(queueId); queues.push([queueId, branch, service, ymd(day), 400, 0]); }
    const [h, m] = hhmm.split(':').map(Number);
    const joined = new Date(day); joined.setHours(h, m, 0, 0);
    const at = (mins) => dt(new Date(joined.getTime() + mins * 60000));
    const checked = service === 'svc-lgb-acct' || service === 'svc-lgb-loan';
    clientTickets.push([`lgbv-c-${String(num).padStart(4, '0')}`, queueId, user, `${prefix}-H${String(pos).padStart(3, '0')}`, code, pos,
      status, wait, channel, dt(joined), at(wait), status === 'served' || status === 'left' ? at(wait + 1) : null, at(wait + svc),
      staff, counter, reason, checked ? dt(joined) : null,
      checked ? (reason === 'wrong_documents' ? 'incomplete' : 'ready') : 'not_checked', note]);
  }

  const TICKET_COLS = ['id', 'queue_id', 'ticket_number', 'verification_code', 'position', 'status', 'estimated_wait_minutes',
    'joined_at', 'called_at', 'started_serving_at', 'completed_at', 'channel', 'served_by_staff_id',
    'served_at_counter_id', 'closed_reason'];

  out('-- Generated by apps/backend/scripts/seed-showcase-history.js. Fictional. Lignum Bank only.');
  out('SET NAMES utf8mb4;');
  out('START TRANSACTION;');
  out("DELETE FROM counter_sittings WHERE id LIKE 'lgbv-%';");
  out("DELETE FROM staff_shifts WHERE id LIKE 'lgbv-%';");
  out("DELETE FROM wait_time_records WHERE ticket_id LIKE 'lgbv-%';");
  out("DELETE FROM queue_tickets WHERE id LIKE 'lgbv-%';");
  out("DELETE q FROM queues q LEFT JOIN queue_tickets t ON t.queue_id = q.id WHERE q.id LIKE 'lgbv-%' AND t.id IS NULL;");

  out(`INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status) VALUES`);
  out(`${STAFF.map(([id, branch, role, code, name, mail, svc]) => `(${[id, BIZ, branch, role, code, name, `${mail}@lignumbank.demo`, svc].map(sql).join(',')},TRUE,'active')`).join(',\n')}`);
  out('ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), branch_id = VALUES(branch_id), assigned_service_id = VALUES(assigned_service_id);');

  // Lines are matched on branch, service and day, so one the server already
  // opened for a past day keeps its id and the visits go into it.
  out('CREATE TEMPORARY TABLE lgbv_lines (id VARCHAR(64) PRIMARY KEY, branch_id CHAR(36), service_id CHAR(36), queue_date DATE);');
  insert('lgbv_lines', ['id', 'branch_id', 'service_id', 'queue_date'], queues.map((q) => q.slice(0, 4)));
  out(`INSERT IGNORE INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT id, branch_id, service_id, queue_date, 400, 0 FROM lgbv_lines;`);
  out(`CREATE TEMPORARY TABLE lgbv_tickets (${TICKET_COLS.map((c) => (c === 'id' ? 'id VARCHAR(64) PRIMARY KEY' : `${c} VARCHAR(64)`)).join(', ')});`);
  insert('lgbv_tickets', TICKET_COLS, tickets);
  out(`INSERT INTO queue_tickets (${TICKET_COLS.join(', ')})
SELECT ${TICKET_COLS.map((c) => (c === 'queue_id' ? 'q.id' : `t.${c}`)).join(', ')}
  FROM lgbv_tickets t
  JOIN lgbv_lines l ON l.id = t.queue_id
  JOIN queues q ON q.branch_id = l.branch_id AND q.service_id = l.service_id AND q.queue_date = l.queue_date;`);
  insert('wait_time_records',
    ['id', 'ticket_id', 'business_id', 'branch_id', 'service_id', 'visit_date', 'day_of_week', 'hour_of_day',
      'month_of_year', 'wait_time_minutes', 'service_time_minutes', 'status', 'channel', 'staff_count_at_time',
      'queue_length_at_time', 'active_counters_at_time'], waits);
  insert('staff_shifts', ['id', 'staff_id', 'branch_id', 'counter_id', 'clocked_in_at', 'clocked_out_at', 'break_seconds'], SHIFTS);
  insert('counter_sittings', ['id', 'counter_id', 'staff_id', 'shift_id', 'opened_at', 'closed_at', 'end_reason'], SITTINGS);

  /* Clients: the people, their visits, and two staff flags so the case list
     shows what flagging looks like. Flags are set by the presenter manager and
     supervisor (Marcus Reid, Nadine Clarke). */
  out('INSERT INTO users (id, email, full_name, phone) VALUES');
  out(`${CLIENTS.map((r) => `(${r.map(sql).join(',')})`).join(',\n')}`);
  out('ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone);');
  const CLIENT_COLS = ['id', 'queue_id', 'user_id', 'ticket_number', 'verification_code', 'position', 'status',
    'estimated_wait_minutes', 'channel', 'joined_at', 'called_at', 'started_serving_at', 'completed_at',
    'served_by_staff_id', 'served_at_counter_id', 'closed_reason', 'readiness_shown_at', 'readiness_outcome', 'readiness_note'];
  out(`CREATE TEMPORARY TABLE lgbv_clients (${CLIENT_COLS.map((c) => (c === 'id' ? 'id VARCHAR(64) PRIMARY KEY' : `${c} VARCHAR(255)`)).join(', ')});`);
  insert('lgbv_clients', CLIENT_COLS, clientTickets);
  out(`INSERT INTO queue_tickets (${CLIENT_COLS.join(', ')})
SELECT ${CLIENT_COLS.map((c) => (c === 'queue_id' ? 'q.id' : `t.${c}`)).join(', ')}
  FROM lgbv_clients t
  JOIN lgbv_lines l ON l.id = t.queue_id
  JOIN queues q ON q.branch_id = l.branch_id AND q.service_id = l.service_id AND q.queue_date = l.queue_date;`);
  out("DELETE FROM patient_flags WHERE id LIKE 'lgbv-%';");
  out(`INSERT INTO patient_flags (id, business_id, user_id, flag, note, set_by_staff_id, created_at) VALUES
  ('lgbv-pf-01', '${BIZ}', 'usr-lgb-c02', 'priority', 'Pensioner, 78. Pension payment held; Client Service lead is following up.', 'stf-lgbx-mgr', NOW() - INTERVAL 2 DAY),
  ('lgbv-pf-02', '${BIZ}', 'usr-lgb-c03', 'watch', 'Disputed card charges; Card Services lead to call back.', 'stf-lgbx-sup', NOW() - INTERVAL 3 DAY);`);
  out('COMMIT;');
  process.stderr.write(`${tickets.length} visits and ${clientTickets.length} client visits over ${queues.length} lines, ending ${ymd(new Date(today.getTime() - 864e5))}\n`);
}

main();
