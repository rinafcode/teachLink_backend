/**
 * Search-specific constants for Elasticsearch queries, pagination, and aggregations.
 */
export const SEARCH_CONSTANTS = {
  // Query limits
  MAX_QUERY_LENGTH: 200,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,

  // Elasticsearch settings
  ELASTICSEARCH_TIMEOUT: '1500ms',
  AUTOCOMPLETE_TIMEOUT: '1000ms',
  TRACK_TOTAL_HITS: 10_000,

  // Scoring factors
  VIEWS_BOOST_FACTOR: 0.1,
  RATING_BOOST_FACTOR: 0.5,
  TIME_DECAY_FACTOR: 0.5,

  // Highlight settings
  HIGHLIGHT_FRAGMENT_SIZE: 150,
  HIGHLIGHT_NUM_FRAGMENTS: 1,

  // Price range aggregation boundaries
  PRICE_RANGES: {
    LOW: 50,
    MID: 100,
    HIGH: 200,
  },

  // Aggregation sizes
  TOP_QUERIES_SIZE: 10,
  AUTOCOMPLETE_SIZE: 10,
  AGG_CATEGORIES_SIZE: 50,
  AGG_LEVELS_SIZE: 10,
  AGG_LANGUAGES_SIZE: 30,
} as const;
