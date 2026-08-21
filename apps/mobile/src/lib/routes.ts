/**
 * routes.ts — Central route constants for LYNE Mobile App
 *
 * All navigation route names are defined here to prevent hardcoded
 * strings scattered across the codebase.
 */

export const MOBILE_ROUTES = {
  // Auth stack
  AUTH: {
    STACK:    'AuthStack',
    LOGIN:    'Login',
    SIGNUP:   'Signup',
    ONBOARD:  'Onboarding',
  },

  // Main tab navigator
  MAIN: {
    STACK:    'MainStack',
    HOME:     'Home',
    SEARCH:   'Search',
    HISTORY:  'History',
    PROFILE:  'Profile',
  },

  // Queue flow stack
  QUEUE: {
    STACK:    'QueueStack',
    BUSINESS: 'Business',
    BRANCH:   'Branch',
    SERVICE:  'Service',
    JOIN:     'JoinQueue',
    TICKET:   'Ticket',
  },
} as const;

export default MOBILE_ROUTES;
