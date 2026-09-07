// Mock data for Lyne — Jamaican virtual queue app
export type BranchStatus = "open" | "closing_soon" | "closed";
export type TicketStatus =
  | "joined"
  | "travelling"
  | "checked_in"
  | "almost_up"
  | "called"
  | "in_service"
  | "completed"
  | "cancelled"
  | "no_show"
  | "requeued";

export interface Branch {
  id: string;
  name: string;
  area: string;
  address: string;
  distanceKm: number;
  status: BranchStatus;
  hoursToday: string;
  shortestWaitMins: number;
  accessible: boolean;
  virtualJoining: boolean;
  services: string[];
  image: string;
  notice?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  who: string;
  documents: string[];
  fee?: string;
  typicalDurationMins: number;
  supportsQueue: boolean;
  supportsSession: boolean;
}

export interface Ticket {
  id: string;
  number: string;
  serviceId: string;
  serviceName: string;
  branchId: string;
  branchName: string;
  status: TicketStatus;
  peopleAhead: number;
  etaMins: number;
  joinedAt: string;
  lastUpdated: string;
  verificationCode: string;
  windowAssignment?: string;
  countdownEndsAt?: string;
}

export interface Session {
  id: string;
  title: string;
  branchId: string;
  branchName: string;
  date: string;
  timeRange: string;
  reservedCount: number;
  capacity: number;
  documents: string[];
  eligibility: string;
  recommendedArrival: string;
}

export interface Reservation {
  id: string;
  sessionId: string;
  sessionTitle: string;
  branchName: string;
  date: string;
  timeRange: string;
  reference: string;
  accessCode: string;
  status: "reserved" | "checked_in" | "attended" | "missed";
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  when: string;
  group: "today" | "earlier";
  read: boolean;
  ticketId?: string;
  reservationId?: string;
  kind: "info" | "urgent" | "success";
}

export const CURRENT_USER = {
  name: "Shanique",
  fullName: "Shanique Powell",
  initials: "SP",
  phone: "+1 876 555 0142",
  email: "shanique.powell@example.com",
  area: "Kingston, Jamaica",
};

export interface Agency {
  id: string;
  code: string;
  name: string;
  shortName: string;
  branchesCount: number;
  primaryBranch: string;
  waitMins: number;
  inLine: number;
  verified: boolean;
  city: string;
  logoBg: string;
  logoFg: string;
}

export const AGENCIES: Agency[] = [
  {
    id: "a1",
    code: "TAJ",
    name: "Tax Administration Jamaica",
    shortName: "Tax Admin Jamaica",
    branchesCount: 5,
    primaryBranch: "Kingston · Half Way Tree",
    waitMins: 19,
    inLine: 41,
    verified: true,
    city: "Kingston",
    logoBg: "#FFFFFF",
    logoFg: "#0B192C",
  },
  {
    id: "a2",
    code: "CFC",
    name: "Community First Credit Union",
    shortName: "Community First",
    branchesCount: 3,
    primaryBranch: "Half Way Tree",
    waitMins: 15,
    inLine: 11,
    verified: true,
    city: "Kingston",
    logoBg: "#0B192C",
    logoFg: "#FFFFFF",
  },
  {
    id: "a3",
    code: "NHT",
    name: "National Housing Trust",
    shortName: "NHT",
    branchesCount: 4,
    primaryBranch: "New Kingston",
    waitMins: 27,
    inLine: 22,
    verified: true,
    city: "Kingston",
    logoBg: "#1D4ED8",
    logoFg: "#FFFFFF",
  },
  {
    id: "a4",
    code: "PP",
    name: "Passport Immigration & Citizenship Agency",
    shortName: "Passport Office",
    branchesCount: 2,
    primaryBranch: "Constant Spring",
    waitMins: 44,
    inLine: 68,
    verified: true,
    city: "Kingston",
    logoBg: "#0F9D58",
    logoFg: "#FFFFFF",
  },
];

// Active hero ticket used by the redesigned Home strip and Ticket screen.
export const ACTIVE_TICKET_HERO = {
  spot: 2,
  number: "MEM-003",
  ahead: 1,
  etaMins: 14,
  status: "Waiting",
  branch: "Montego Bay Member Centre",
  branchShort: "Montego Bay Member Centre",
  service: "Membership & Account Opening",
  agencyCode: "CFC",
  agencyName: "Community First Credit Union",
  holder: "Shanique Powell",
  code: "FHTDA9",
};

export const BRANCHES: Branch[] = [
  {
    id: "b1",
    name: "Half Way Tree",
    area: "Kingston 10",
    address: "8 Constant Spring Rd, Kingston 10",
    distanceKm: 1.2,
    status: "open",
    hoursToday: "8:30 AM – 4:00 PM",
    shortestWaitMins: 18,
    accessible: true,
    virtualJoining: true,
    services: ["s1", "s2", "s3", "s4", "s5"],
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
  },
  {
    id: "b2",
    name: "Constant Spring",
    area: "Kingston 8",
    address: "125 Constant Spring Rd, Kingston 8",
    distanceKm: 3.8,
    status: "open",
    hoursToday: "8:30 AM – 4:00 PM",
    shortestWaitMins: 32,
    accessible: true,
    virtualJoining: true,
    services: ["s1", "s2", "s3", "s5"],
    image: "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=800",
    notice: "Cashier services pause 12:30 – 1:00 PM",
  },
  {
    id: "b3",
    name: "Cross Roads",
    area: "Kingston 5",
    address: "18 Half Way Tree Rd, Kingston 5",
    distanceKm: 2.1,
    status: "closing_soon",
    hoursToday: "8:30 AM – 3:00 PM",
    shortestWaitMins: 45,
    accessible: false,
    virtualJoining: true,
    services: ["s1", "s3", "s5"],
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800",
  },
  {
    id: "b4",
    name: "Spanish Town",
    area: "St. Catherine",
    address: "12 Burke Rd, Spanish Town",
    distanceKm: 18.4,
    status: "open",
    hoursToday: "8:30 AM – 4:00 PM",
    shortestWaitMins: 22,
    accessible: true,
    virtualJoining: true,
    services: ["s1", "s2", "s3", "s4", "s5"],
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800",
  },
  {
    id: "b5",
    name: "Montego Bay",
    area: "St. James",
    address: "Suite 4, Overton Plaza, Montego Bay",
    distanceKm: 156.0,
    status: "closed",
    hoursToday: "Closed today",
    shortestWaitMins: 0,
    accessible: true,
    virtualJoining: false,
    services: ["s1", "s2", "s3", "s5"],
    image: "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800",
  },
];

export const SERVICES: Service[] = [
  {
    id: "s1",
    name: "TRN Registration",
    category: "Registration",
    description:
      "Apply for a Taxpayer Registration Number (TRN) — required for banking, employment, and most public services.",
    who: "Individuals aged 14+ without an existing TRN.",
    documents: ["Valid ID (passport, driver’s licence, or voter’s ID)", "Proof of address (utility bill)"],
    fee: "No fee",
    typicalDurationMins: 15,
    supportsQueue: true,
    supportsSession: true,
  },
  {
    id: "s2",
    name: "Tax Payments",
    category: "Payments",
    description: "Pay income tax, property tax, GCT, or motor vehicle fees.",
    who: "Anyone with outstanding payments to Tax Administration Jamaica.",
    documents: ["TRN", "Payment reference or bill", "Payment method"],
    typicalDurationMins: 10,
    supportsQueue: true,
    supportsSession: false,
  },
  {
    id: "s3",
    name: "Income Tax Filing",
    category: "Filing",
    description: "File your annual income tax return with support from a tax officer.",
    who: "Self-employed individuals, partnerships, and companies.",
    documents: ["TRN", "Income statements", "Receipts for allowable deductions"],
    typicalDurationMins: 25,
    supportsQueue: true,
    supportsSession: true,
  },
  {
    id: "s4",
    name: "GCT Registration",
    category: "Registration",
    description: "Register a business for General Consumption Tax collection.",
    who: "Businesses with taxable turnover above the GCT threshold.",
    documents: ["TRN", "Business registration certificate", "Bank details"],
    typicalDurationMins: 30,
    supportsQueue: true,
    supportsSession: false,
  },
  {
    id: "s5",
    name: "General Enquiries",
    category: "Support",
    description: "Speak with an officer about any tax question or account issue.",
    who: "Anyone with questions about their tax records or services.",
    documents: ["Valid ID"],
    typicalDurationMins: 8,
    supportsQueue: true,
    supportsSession: false,
  },
];

// Active ticket for the current user (demo)
export const ACTIVE_TICKET: Ticket = {
  id: "t1",
  number: "TRN-014",
  serviceId: "s1",
  serviceName: "TRN Registration",
  branchId: "b1",
  branchName: "Half Way Tree",
  status: "joined",
  peopleAhead: 8,
  etaMins: 26,
  joinedAt: "9:42 AM",
  lastUpdated: "just now",
  verificationCode: "482 917",
};

export const SESSIONS: Session[] = [
  {
    id: "sess1",
    title: "Saturday Traffic Ticket Sitting",
    branchId: "b1",
    branchName: "Camp Road Tax Office",
    date: "Saturday, September 12",
    timeRange: "9:00 AM – 4:00 PM",
    reservedCount: 87,
    capacity: 400,
    documents: ["TRN", "Traffic ticket notice", "Valid ID"],
    eligibility: "Motorists with outstanding traffic tickets issued in Kingston & St. Andrew.",
    recommendedArrival: "15 minutes before your reserved time",
  },
  {
    id: "sess2",
    title: "Small Business GCT Clinic",
    branchId: "b2",
    branchName: "Constant Spring",
    date: "Wednesday, September 16",
    timeRange: "10:00 AM – 2:00 PM",
    reservedCount: 34,
    capacity: 60,
    documents: ["TRN", "Business registration certificate"],
    eligibility: "Small businesses interested in GCT registration.",
    recommendedArrival: "10 minutes early",
  },
  {
    id: "sess3",
    title: "Senior Citizens Tax Filing Day",
    branchId: "b4",
    branchName: "Spanish Town",
    date: "Friday, September 18",
    timeRange: "9:00 AM – 1:00 PM",
    reservedCount: 52,
    capacity: 120,
    documents: ["TRN", "Pension statements", "Valid ID"],
    eligibility: "Adults 60+ filing personal income tax.",
    recommendedArrival: "20 minutes before scheduled time",
  },
];

export const RESERVATIONS: Reservation[] = [
  {
    id: "r1",
    sessionId: "sess2",
    sessionTitle: "Small Business GCT Clinic",
    branchName: "Constant Spring",
    date: "Wednesday, September 16",
    timeRange: "10:00 AM – 2:00 PM",
    reference: "LYN-2024-0916-034",
    accessCode: "W7TH-JCM4",
    status: "reserved",
  },
];

export const PAST_VISITS: Ticket[] = [
  {
    id: "pt1",
    number: "GEN-208",
    serviceId: "s5",
    serviceName: "General Enquiries",
    branchId: "b1",
    branchName: "Half Way Tree",
    status: "completed",
    peopleAhead: 0,
    etaMins: 0,
    joinedAt: "Aug 28, 10:12 AM",
    lastUpdated: "Aug 28, 10:47 AM",
    verificationCode: "203 118",
  },
  {
    id: "pt2",
    number: "TAX-092",
    serviceId: "s2",
    serviceName: "Tax Payments",
    branchId: "b2",
    branchName: "Constant Spring",
    status: "completed",
    peopleAhead: 0,
    etaMins: 0,
    joinedAt: "Aug 14, 2:22 PM",
    lastUpdated: "Aug 14, 2:41 PM",
    verificationCode: "774 502",
  },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "You joined the line",
    body: "TRN-014 · Half Way Tree · about 26 minutes wait",
    when: "9:42 AM",
    group: "today",
    read: false,
    ticketId: "t1",
    kind: "info",
  },
  {
    id: "n2",
    title: "Wait time updated",
    body: "Your estimated wait is now 22 minutes — 6 people ahead.",
    when: "10:01 AM",
    group: "today",
    read: false,
    ticketId: "t1",
    kind: "info",
  },
  {
    id: "n3",
    title: "Time to start heading in",
    body: "You’re getting close. Head to Half Way Tree now.",
    when: "10:08 AM",
    group: "today",
    read: true,
    ticketId: "t1",
    kind: "urgent",
  },
  {
    id: "n4",
    title: "Reservation confirmed",
    body: "Small Business GCT Clinic · September 16 · Access code W7TH-JCM4",
    when: "Yesterday",
    group: "earlier",
    read: true,
    reservationId: "r1",
    kind: "success",
  },
  {
    id: "n5",
    title: "Visit completed",
    body: "GEN-208 · General Enquiries at Half Way Tree — Thank you.",
    when: "Aug 28",
    group: "earlier",
    read: true,
    kind: "success",
  },
];

export function serviceById(id: string) {
  return SERVICES.find((s) => s.id === id);
}

// ---------- Facelift data ----------

// Live line stats per service (deterministic mock)
export const LINE_STATS: Record<string, { inLine: number; counters: number; waitMins: number }> = {
  s1: { inLine: 0, counters: 5, waitMins: 0 },
  s2: { inLine: 6, counters: 3, waitMins: 20 },
  s3: { inLine: 4, counters: 2, waitMins: 32 },
  s4: { inLine: 2, counters: 1, waitMins: 18 },
  s5: { inLine: 1, counters: 1, waitMins: 14 },
};

export interface AgencyBranch {
  id: string;
  agencyId: string;
  name: string;
  city: string;
  openLines: number;
  closesAt: string;
  waitMins: number;
  inLine: number;
  branchId: string;
  serviceId: string;
}

export const AGENCY_BRANCHES: AgencyBranch[] = [
  { id: "ab1", agencyId: "a2", name: "Montego Bay Member Centre", city: "Montego Bay", openLines: 2, closesAt: "11:59 PM", waitMins: 0, inLine: 2, branchId: "b1", serviceId: "s5" },
  { id: "ab2", agencyId: "a2", name: "Half Way Tree Member Centre", city: "Kingston", openLines: 3, closesAt: "11:59 PM", waitMins: 15, inLine: 11, branchId: "b1", serviceId: "s2" },
  { id: "ab3", agencyId: "a4", name: "Constant Spring Passport Office", city: "Kingston", openLines: 4, closesAt: "4:00 PM", waitMins: 44, inLine: 68, branchId: "b2", serviceId: "s3" },
  { id: "ab4", agencyId: "a1", name: "Kingston · Half Way Tree", city: "Kingston", openLines: 5, closesAt: "4:00 PM", waitMins: 19, inLine: 41, branchId: "b1", serviceId: "s1" },
  { id: "ab5", agencyId: "a3", name: "New Kingston Service Centre", city: "Kingston", openLines: 2, closesAt: "3:30 PM", waitMins: 27, inLine: 22, branchId: "b3", serviceId: "s5" },
  { id: "ab6", agencyId: "a1", name: "Spanish Town Tax Office", city: "St. Catherine", openLines: 3, closesAt: "4:00 PM", waitMins: 22, inLine: 17, branchId: "b4", serviceId: "s2" },
];

export const QUICK_SEARCHES = ["Passport renewal", "TRN registration", "Tax payments", "NHT benefits"];
export const AGENCY_CHIPS = ["Traffic Court", "First Heritage", "Community First", "Tax Admin", "NHT"];

export const LEAVE_REASONS = [
  "The wait was too long",
  "I'll come back another time",
  "I don't need it any more",
  "I joined the wrong line",
  "Someone helped me already",
  "Another reason",
];

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  required: boolean;
  group: "bring" | "before";
}

const DOC_HINTS: Record<string, string> = {
  TRN: "Your Tax Registration Number card or a clear copy.",
  "Valid ID": "Bring the original document, not only a photo.",
};

export function checklistFor(svc: Service): ChecklistItem[] {
  const bring = svc.documents.map((d, i) => ({
    id: `doc-${i}`,
    label: d.replace(/\s*\(.*\)$/, ""),
    hint: DOC_HINTS[d] ?? (d.includes("address") ? "Utility bill or bank statement issued within the last three months." : "Have the original ready for the officer."),
    required: true,
    group: "bring" as const,
  }));
  return [
    ...bring,
    {
      id: "contact",
      label: "Choose an emergency contact",
      hint: "Have their full name and phone number ready.",
      required: false,
      group: "before",
    },
  ];
}

export function agencyById(id: string) {
  return AGENCIES.find((a) => a.id === id);
}
export function branchById(id: string) {
  return BRANCHES.find((b) => b.id === id);
}
export function sessionById(id: string) {
  return SESSIONS.find((s) => s.id === id);
}
export function reservationById(id: string) {
  return RESERVATIONS.find((r) => r.id === id);
}
