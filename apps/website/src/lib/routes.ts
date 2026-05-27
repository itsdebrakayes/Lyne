/**
 * routes.ts — Central route constants for Q ME NOW website
 *
 * All client-side route paths are defined here to prevent hardcoded
 * strings scattered across the codebase. Import this file wherever
 * route strings are needed.
 */

export const ROUTES = {
  // Public
  HOME:         '/',
  ABOUT:        '/about',
  JOIN_US:      '/join-us',
  SIGNUP:       '/signup',
  LOGIN:        '/login',

  // Client queue flow
  CLIENT:       (slug: string) => `/client/${slug}`,
  CLIENT_JOIN:  (slug: string) => `/client/${slug}/join`,
  CLIENT_TICKET:(slug: string) => `/client/${slug}/ticket`,
  CLIENT_BEST:  (slug: string) => `/client/${slug}/best-time`,

  // Protected user routes
  SERVICE_SELECT: '/service-select',
  TICKET:         '/ticket',

  // Admin
  ADMIN_LOGIN:    '/admin/login',
  ADMIN:          '/admin',
  ADMIN_CUSTOMERS:'/admin/customers',
  ADMIN_SERVICES: '/admin/services',
  ADMIN_STAFF:    '/admin/staff',
  ADMIN_STAFF_DETAIL: (userId: string) => `/admin/staff/${userId}`,
  ADMIN_ANALYTICS:'/admin/analytics',
  ADMIN_SETTINGS: '/admin/settings',

  // 404
  NOT_FOUND: '*',
} as const;

export default ROUTES;
