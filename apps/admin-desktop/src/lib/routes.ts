/**
 * routes.ts — Central route constants for Lyne Admin Desktop App
 *
 * All client-side route paths are defined here to prevent hardcoded
 * strings scattered across the codebase.
 */

export const ADMIN_ROUTES = {
  LOGIN:     '/login',
  ROOT:      '/',
  STAFF:     '/staff',
  MANAGER:   '/manager',
  EXECUTIVE: '/executive',
} as const;

export default ADMIN_ROUTES;
