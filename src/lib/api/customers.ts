// Customer-related API calls - SKELETON (implement your own backend)

import type { Customer, VisitRecord, CustomerSearchFilters } from '@/types/customer';

export async function fetchCustomers(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<Customer[]> {
  // TODO: Implement with your backend
  console.log('fetchCustomers called', { organizationId, filters });
  return [];
}

export async function fetchVisitHistory(
  organizationId: string,
  filters?: CustomerSearchFilters & { page?: number; pageSize?: number }
): Promise<{ records: VisitRecord[]; total: number }> {
  // TODO: Implement with your backend
  console.log('fetchVisitHistory called', { organizationId, filters });
  return {
    records: [],
    total: 0
  };
}

export async function fetchCustomerById(customerId: string): Promise<Customer | null> {
  // TODO: Implement with your backend
  console.log('fetchCustomerById called', { customerId });
  return null;
}

export async function fetchCustomerVisits(
  customerId: string,
  organizationId: string
): Promise<VisitRecord[]> {
  // TODO: Implement with your backend
  console.log('fetchCustomerVisits called', { customerId, organizationId });
  return [];
}

export async function exportVisitHistoryCSV(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<string> {
  // TODO: Implement with your backend
  console.log('exportVisitHistoryCSV called', { organizationId, filters });
  return '';
}
