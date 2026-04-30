/**
 * businesses.ts — Businesses API (MySQL backend)
 */

import api from '@/lib/apiClient';

export interface Business {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  subscription_tier_id: string;
  tier_name: string;
  tier_label: string;
  can_view_analytics: boolean;
  can_view_predictions: boolean;
  can_view_multi_branch: boolean;
  can_view_executive_reports: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchBusinesses(): Promise<Business[]> {
  return api.get<Business[]>('/businesses', false);
}

export async function fetchBusinessBySlug(slug: string): Promise<Business> {
  return api.get<Business>(`/businesses/${slug}`, false);
}

export async function createBusiness(data: Partial<Business>): Promise<Business> {
  return api.post<Business>('/businesses', data);
}

export async function updateBusiness(id: string, data: Partial<Business>): Promise<Business> {
  return api.put<Business>(`/businesses/${id}`, data);
}
