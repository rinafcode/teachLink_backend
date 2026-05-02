/**
 * GraphQL query complexity constants.
 * Centralizes magic numbers for query validation and complexity analysis.
 */
export const GRAPHQL_CONSTANTS = {
  // Query limits
  MAX_DEPTH: 10,
  MAX_COMPLEXITY: 1000,
  LIST_SCALAR_MULTIPLIER: 10,
  DEFAULT_LIST_SIZE: 10,

  // Field complexity map
  FIELD_COMPLEXITY_MAP: {
    // User queries
    User: 5,
    users: 10,
    currentUser: 2,

    // Course queries - higher cost for list queries
    Course: 5,
    courses: 15,
    courseById: 3,
    popularCourses: 20,
    searchCourses: 25,

    // Assessment queries
    Assessment: 5,
    assessments: 15,
    assessmentById: 3,
    questions: 20,

    // Results and analytics
    results: 30,
    analytics: 50,
    statistics: 40,

    // Connection/N+1 patterns
    edges: 2,
    node: 1,
    pageInfo: 1,
  },
} as const;
