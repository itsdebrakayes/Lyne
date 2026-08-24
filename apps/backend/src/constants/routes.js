/**
 * routes.js — Central route constants for LYNE backend
 *
 * All route paths are defined here to prevent hardcoded strings
 * scattered across the codebase. Import this file wherever route
 * strings are needed.
 */

const ROUTES = {
  // Health
  HEALTH: '/health',

  // Auth
  AUTH: {
    BASE:       '/api/auth',
    SYNC_USER:  '/api/auth/sync-user',
    ME:         '/api/auth/me',
    INVITE:     '/api/auth/invite',
    STAFF_INVITE: '/api/auth/staff-invite',
  },

  // Businesses
  BUSINESSES: {
    BASE:   '/api/businesses',
    BY_SLUG: '/api/businesses/:slug',
    BY_ID:   '/api/businesses/:id',
  },

  // Branches
  BRANCHES: {
    BASE:   '/api/branches',
    BY_ID:  '/api/branches/:id',
  },

  // Services
  SERVICES: {
    BASE:   '/api/services',
    BY_ID:  '/api/services/:id',
  },

  // Queues
  QUEUES: {
    BASE:   '/api/queues',
    LIVE:   '/api/queues/live',
    BY_ID:  '/api/queues/:id',
    CLOSE:  '/api/queues/:id/close',
  },

  // Tickets
  TICKETS: {
    BASE:        '/api/tickets',
    BY_ID:       '/api/tickets/:id',
    BY_QUEUE:    '/api/tickets/queue/:queue_id',
    STATUS:      '/api/tickets/:id/status',
    MOVE_UP:     '/api/tickets/:id/move-up',
    MOVE_DOWN:   '/api/tickets/:id/move-down',
    POSITION:    '/api/tickets/:id/position',
  },

  // Staff
  STAFF: {
    BASE:   '/api/staff',
    BY_ID:  '/api/staff/:id',
  },

  // Assignments
  ASSIGNMENTS: {
    BASE:   '/api/assignments',
    BY_ID:  '/api/assignments/:id',
  },

  // Analytics
  ANALYTICS: {
    BASE:     '/api/analytics',
    SUMMARY:  '/api/analytics/summary',
    HEATMAP:  '/api/analytics/heatmap',
    SERVICES: '/api/analytics/services',
    STAFF:    '/api/analytics/staff',
  },

  // Predictions
  PREDICTIONS: {
    BASE: '/api/predictions',
  },

  // User data
  HISTORY:       '/api/history',
  SAVED:         '/api/saved',
  SAVED_BY_ID:   '/api/saved/:business_id',
  NOTIFICATIONS: '/api/notifications',
  NOTIFICATIONS_READ: '/api/notifications/:id/read',

  // OCR
  OCR: {
    BASE:   '/api/ocr',
    SCAN:   '/api/ocr/scan',
    REVIEW: '/api/ocr/review',
    SUBMIT: '/api/ocr/submit',
  },

  // Audit log
  AUDIT: {
    BASE: '/api/audit',
  },
};

module.exports = ROUTES;
