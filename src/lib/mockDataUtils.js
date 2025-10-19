import mockServices from '@/data/mockServices.json';
import mockCustomers from '@/data/mockCustomers.json';
import mockQueueData from '@/data/mockQueueData.json';
import mockStats from '@/data/mockStats.json';

export const getServices = () => mockServices;

export const getCustomers = () => mockCustomers;

export const getQueueData = () => mockQueueData;

export const getStats = () => mockStats;

export const filterCustomers = (customers, filterType, searchTerm = '') => {
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
      filtered.sort((a, b) => new Date(b.lastVisited) - new Date(a.lastVisited));
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.lastVisited) - new Date(b.lastVisited));
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

export const getActiveQueueByService = (serviceId) => {
  const queue = mockQueueData.queueEntries.filter(
    (entry) => entry.serviceId === serviceId && entry.status === 'waiting'
  );
  return queue.sort((a, b) => a.position - b.position);
};

export const getAllActiveQueue = () => {
  return mockQueueData.queueEntries
    .filter((entry) => entry.status === 'waiting')
    .sort((a, b) => a.position - b.position);
};

export const getServingQueue = () => {
  return mockQueueData.queueEntries.filter((entry) => entry.status === 'serving');
};

export const getCustomerById = (customerId) => {
  return mockCustomers.find((customer) => customer.id === customerId);
};

export const getServiceById = (serviceId) => {
  return mockServices.find((service) => service.id === serviceId);
};

export const calculateTimeRemaining = (startTime, limitMinutes) => {
  const start = new Date(startTime);
  const now = new Date();
  const elapsed = Math.floor((now - start) / 1000 / 60); // minutes
  const remaining = Math.max(0, limitMinutes - elapsed);
  return remaining;
};

export const formatWaitTime = (minutes) => {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
};

export const getInitials = (name) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};
