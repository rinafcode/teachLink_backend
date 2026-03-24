/**
 * Application constants
 * Centralized location for magic values and configuration constants
 */

export const APP_CONSTANTS = {
  // Security constants
  DUMMY_USER_ID: '00000000-0000-0000-0000-000000000000',

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Status values
  COURSE_STATUS: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
  },

  ENROLLMENT_STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  // Role constants
  USER_ROLES: {
    INSTRUCTOR: 'instructor',
    STUDENT: 'student',
    ADMIN: 'admin',
  },
} as const;
