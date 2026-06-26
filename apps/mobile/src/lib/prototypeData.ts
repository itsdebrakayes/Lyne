export type QueueStatus = 'light' | 'moderate' | 'busy';

export interface DemoService {
  id: string;
  name: string;
  wait: number;
  people: number;
  lines: number;
  status: QueueStatus;
}

export interface DemoBranch {
  id: string;
  short: string;
  agency: string;
  branch: string;
  parish: string;
  distance: string;
  wait: number;
  people: number;
  status: QueueStatus;
  mono: string;
  latitude?: number;
  longitude?: number;
  services: DemoService[];
}

export const demoBranches: DemoBranch[] = [
  {
    id: 'taj-cs',
    short: 'TAJ',
    agency: 'Tax Administration Jamaica',
    branch: 'Constant Spring',
    parish: 'Kingston',
    distance: '1.2 km',
    wait: 32,
    people: 18,
    status: 'moderate',
    mono: 'TAJ',
    latitude: 18.0396,
    longitude: -76.7981,
    services: [
      { id: 'trn', name: 'TRN Registration', wait: 6, people: 4, lines: 2, status: 'light' },
      { id: 'tax-payment', name: 'Tax Payment', wait: 32, people: 11, lines: 3, status: 'moderate' },
      { id: 'drivers-licence', name: "Driver's Licence", wait: 54, people: 21, lines: 2, status: 'busy' },
      { id: 'motor-vehicle', name: 'Motor Vehicle Reg.', wait: 18, people: 7, lines: 1, status: 'moderate' },
    ],
  },
  {
    id: 'nht-hwt',
    short: 'NHT',
    agency: 'National Housing Trust',
    branch: 'Half Way Tree',
    parish: 'St. Andrew',
    distance: '3.4 km',
    wait: 47,
    people: 26,
    status: 'busy',
    mono: 'NHT',
    latitude: 18.0125,
    longitude: -76.7961,
    services: [
      { id: 'contributions', name: 'Contributions', wait: 47, people: 19, lines: 3, status: 'busy' },
      { id: 'mortgage', name: 'Mortgage Enquiry', wait: 22, people: 8, lines: 2, status: 'moderate' },
      { id: 'refund', name: 'Refund Application', wait: 12, people: 5, lines: 1, status: 'light' },
    ],
  },
  {
    id: 'pica-kgn',
    short: 'PICA',
    agency: 'Passport, Immigration & Citizenship',
    branch: 'Mandela Highway',
    parish: 'Kingston',
    distance: '5.1 km',
    wait: 14,
    people: 9,
    status: 'light',
    mono: 'PICA',
    latitude: 17.9927,
    longitude: -76.8577,
    services: [
      { id: 'new-passport', name: 'New Passport', wait: 14, people: 6, lines: 2, status: 'light' },
      { id: 'renewal', name: 'Passport Renewal', wait: 9, people: 4, lines: 2, status: 'light' },
      { id: 'citizenship', name: 'Citizenship', wait: 38, people: 12, lines: 1, status: 'moderate' },
    ],
  },
  {
    id: 'nwc-kgn',
    short: 'NWC',
    agency: 'National Water Commission',
    branch: 'Marescaux Road',
    parish: 'Kingston',
    distance: '2.0 km',
    wait: 21,
    people: 11,
    status: 'moderate',
    mono: 'NWC',
    latitude: 18.0009,
    longitude: -76.7938,
    services: [
      { id: 'bill-payment', name: 'Bill Payment', wait: 8, people: 5, lines: 2, status: 'light' },
      { id: 'new-connection', name: 'New Connection', wait: 30, people: 9, lines: 2, status: 'moderate' },
      { id: 'account-query', name: 'Account Query', wait: 21, people: 7, lines: 1, status: 'moderate' },
    ],
  },
  {
    id: 'jps-nk',
    short: 'JPS',
    agency: 'Jamaica Public Service',
    branch: 'New Kingston',
    parish: 'St. Andrew',
    distance: '3.1 km',
    wait: 8,
    people: 4,
    status: 'light',
    mono: 'JPS',
    latitude: 18.0074,
    longitude: -76.7832,
    services: [
      { id: 'bill-payment', name: 'Bill Payment', wait: 8, people: 4, lines: 2, status: 'light' },
      { id: 'new-service', name: 'New Service', wait: 19, people: 6, lines: 1, status: 'moderate' },
    ],
  },
  {
    id: 'scotia-lig',
    short: 'Scotia',
    agency: 'Scotiabank Jamaica',
    branch: 'Liguanea',
    parish: 'St. Andrew',
    distance: '4.4 km',
    wait: 12,
    people: 6,
    status: 'light',
    mono: 'SB',
    latitude: 18.0222,
    longitude: -76.7621,
    services: [
      { id: 'teller', name: 'Teller Services', wait: 12, people: 6, lines: 3, status: 'light' },
      { id: 'accounts', name: 'Account Services', wait: 25, people: 9, lines: 2, status: 'moderate' },
      { id: 'loans', name: 'Loans & Mortgage', wait: 40, people: 13, lines: 1, status: 'busy' },
    ],
  },
];

export function getBranch(id?: string) {
  return demoBranches.find((branch) => branch.id === id) || demoBranches[0];
}

export function getService(branchId?: string, serviceId?: string) {
  const branch = getBranch(branchId);
  return branch.services.find((service) => service.id === serviceId) || branch.services[0];
}

export function statusMeta(status: QueueStatus) {
  if (status === 'busy') return { label: 'Busy', color: '#e5484d' };
  if (status === 'moderate') return { label: 'Moderate', color: '#f5a623' };
  return { label: 'Light wait', color: '#2fbf71' };
}
