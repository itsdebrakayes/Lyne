import mockServices from '@/data/mockServices.json';
import mockCustomers from '@/data/mockCustomers.json';
import mockQueueData from '@/data/mockQueueData.json';
import mockStats from '@/data/mockStats.json';

interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  lastVisited: string;
  totalVisits: number;
  servicesUsed: string[];
}

interface Service {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export const getServices = () => mockServices;

export const getCustomers = (): Customer[] => mockCustomers as Customer[];

export const getQueueData = () => mockQueueData;

export const getStats = () => mockStats;

export const filterCustomers = (customers: Customer[], filterType: string, searchTerm = ''): Customer[] => {
  let filtered = [...customers];

  // Apply search filter
  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (customer) =>
        customer.fullName.toLowerCase().includes(search) ||
        customer.email.toLowerCase().includes(search) ||
        customer.phone.includes(search)
    );
  }

  // Apply sort filter
  switch (filterType) {
    case 'recent':
      filtered.sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.lastVisited).getTime() - new Date(b.lastVisited).getTime());
      break;
    case 'a-z':
      filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
      break;
    case 'z-a':
      filtered.sort((a, b) => b.fullName.localeCompare(a.fullName));
      break;
    case 'most-visits':
      filtered.sort((a, b) => b.totalVisits - a.totalVisits);
      break;
    default:
      break;
  }

  return filtered;
};

export const getActiveQueueByService = (serviceId: string) => {
  const queue = mockQueueData.queueEntries.filter(
    (entry: { serviceId: string; status: string }) => entry.serviceId === serviceId && entry.status === 'waiting'
  );
  return queue.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
};

export const getAllActiveQueue = () => {
  return mockQueueData.queueEntries
    .filter((entry: { status: string }) => entry.status === 'waiting')
    .sort((a: { position: number }, b: { position: number }) => a.position - b.position);
};

export const getServingQueue = () => {
  return mockQueueData.queueEntries.filter((entry: { status: string }) => entry.status === 'serving');
};

export const getCustomerById = (customerId: string): Customer | undefined => {
  return (mockCustomers as Customer[]).find((customer) => customer.id === customerId);
};

export const getServiceById = (serviceId: string): Service | undefined => {
  return (mockServices as Service[]).find((service) => service.id === serviceId);
};

export const calculateTimeRemaining = (startTime: string, limitMinutes: number): number => {
  const start = new Date(startTime);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000 / 60); // minutes
  const remaining = Math.max(0, limitMinutes - elapsed);
  return remaining;
};

export const formatWaitTime = (minutes: number): string => {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
};

export const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};
