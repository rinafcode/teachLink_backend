const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const apiDocsDir = path.join(rootDir, 'docs', 'api');
const siteDir = path.join(rootDir, 'docs', 'site');

const json = (value) => JSON.stringify(value, null, 2);

const successEnvelope = (data, message = 'Operation completed successfully') => ({
  success: true,
  message,
  data,
});

const errorEnvelope = (message, field) => ({
  success: false,
  message,
  errors: field ? [{ field, message }] : [],
});

const examples = {
  user: {
    id: '2f4d8b5f-91d2-43a1-bd1e-877b4f97d7b9',
    email: 'learner@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'student',
    status: 'active',
  },
  course: {
    id: '8e4fd4f8-d8f3-46b5-8786-6f7167a654f4',
    title: 'JavaScript Foundations',
    description: 'Learn modern JavaScript from first principles.',
    category: 'programming',
    level: 'beginner',
    price: 3999,
    status: 'published',
  },
  payment: {
    id: 'pay_01JZ0D4R8R2Y3R9H2W6E5R4T1P',
    amount: 3999,
    currency: 'USD',
    status: 'pending',
    providerClientSecret: 'pi_123_secret_456',
  },
};

const schemas = {
  ApiSuccess: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Operation completed successfully' },
      data: { type: 'object' },
    },
  },
  ApiError: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Validation failed' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'email' },
            message: { type: 'string', example: 'email must be valid' },
          },
        },
      },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'learner@example.com' },
      password: { type: 'string', format: 'password', example: 'Password123!' },
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'firstName', 'lastName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'learner@example.com' },
      password: { type: 'string', format: 'password', example: 'Password123!' },
      firstName: { type: 'string', example: 'Ada' },
      lastName: { type: 'string', example: 'Lovelace' },
      role: { type: 'string', enum: ['student', 'teacher'], example: 'student' },
    },
  },
  CourseRequest: {
    type: 'object',
    required: ['title', 'description'],
    properties: {
      title: { type: 'string', example: examples.course.title },
      description: { type: 'string', example: examples.course.description },
      category: { type: 'string', example: examples.course.category },
      level: { type: 'string', example: examples.course.level },
      price: { type: 'number', example: examples.course.price },
    },
  },
  PaymentIntentRequest: {
    type: 'object',
    required: ['courseId', 'amount', 'currency'],
    properties: {
      courseId: { type: 'string', format: 'uuid', example: examples.course.id },
      amount: { type: 'number', example: 3999 },
      currency: { type: 'string', example: 'USD' },
    },
  },
  SearchResponse: {
    type: 'object',
    properties: {
      results: { type: 'array', items: { type: 'object' } },
      total: { type: 'integer', example: 1 },
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      filters: { type: 'object' },
      query: { type: 'string', example: 'javascript basics' },
    },
  },
  AwardActivityRequest: {
    type: 'object',
    required: ['userId', 'activityType'],
    properties: {
      userId: { type: 'string', example: 'user_123' },
      activityType: {
        type: 'string',
        enum: [
          'COURSE_COMPLETED',
          'LESSON_COMPLETED',
          'QUIZ_PASSED',
          'DAILY_LOGIN',
          'PROFILE_COMPLETED',
          'FIRST_COURSE_ENROLLED',
          'REVIEW_SUBMITTED',
          'STREAK_BONUS',
        ],
        example: 'COURSE_COMPLETED',
      },
    },
  },
  AddPointsRequest: {
    type: 'object',
    required: ['userId', 'points', 'activityType'],
    properties: {
      userId: { type: 'string', example: 'user_123' },
      points: { type: 'integer', minimum: 1, example: 100 },
      activityType: { type: 'string', example: 'COURSE_COMPLETED' },
    },
  },
  UpsertRewardRequest: {
    type: 'object',
    required: ['title', 'description'],
    properties: {
      title: { type: 'string', example: 'Gold Badge' },
      description: { type: 'string', example: 'Awarded for reaching Gold tier' },
      badgeId: { type: 'string', example: 'badge_gold' },
      bonusPoints: { type: 'integer', minimum: 0, example: 500 },
      metadata: { type: 'object' },
    },
  },
  RunEtlRequest: {
    type: 'object',
    required: ['source', 'data'],
    properties: {
      source: { type: 'string', example: 'sales_csv' },
      data: { type: 'array', items: { type: 'object' }, example: [{ id: 1, name: 'example' }] },
    },
  },
  RouteShardRequest: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string', example: 'user_123' },
      strategy: {
        type: 'string',
        enum: ['tenant_based', 'hash_based', 'range_based', 'read_replica'],
        example: 'hash_based',
      },
      forRead: { type: 'boolean', example: false },
    },
  },
  StartMigrationRequest: {
    type: 'object',
    required: [
      'sourceShardId',
      'targetShardId',
      'entityType',
      'estimatedRowCount',
      'batchSize',
      'dryRun',
    ],
    properties: {
      sourceShardId: { type: 'string', example: 'shard-00' },
      targetShardId: { type: 'string', example: 'shard-01' },
      entityType: { type: 'string', example: 'users' },
      estimatedRowCount: { type: 'integer', minimum: 1, example: 50000 },
      batchSize: { type: 'integer', minimum: 1, example: 1000 },
      dryRun: { type: 'boolean', example: false },
    },
  },
  ManualRebalanceRequest: {
    type: 'object',
    required: ['migrations', 'dryRun'],
    properties: {
      migrations: { type: 'array', items: { type: 'object' } },
      dryRun: { type: 'boolean', example: false },
    },
  },
  AutoRebalanceRequest: {
    type: 'object',
    required: ['entityTypes', 'autoExecute'],
    properties: {
      entityTypes: { type: 'array', items: { type: 'string' }, example: ['users', 'courses'] },
      autoExecute: { type: 'boolean', example: false },
    },
  },
};

const response = (status, description, example, schemaRef = '#/components/schemas/ApiSuccess') => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: schemaRef },
      examples: {
        default: { value: example },
      },
    },
  },
});

const requestBody = (schemaRef, example) => ({
  required: true,
  content: {
    'application/json': {
      schema: { $ref: schemaRef },
      examples: {
        default: { value: example },
      },
    },
  },
});

const bearerSecurity = [{ bearerAuth: [] }];

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'TeachLink API',
    description:
      'Automatically generated OpenAPI documentation for TeachLink backend APIs, including request and response examples.',
    version: process.env.npm_package_version || '0.0.1',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.teachlink.com', description: 'Production' },
  ],
  tags: [
    { name: 'App', description: 'Service metadata and status' },
    { name: 'Auth', description: 'Registration, login, and token management' },
    { name: 'Users', description: 'User account management' },
    { name: 'Courses', description: 'Course catalog and authoring' },
    { name: 'Payments', description: 'Payments, subscriptions, and refunds' },
    { name: 'Search', description: 'Search, filters, autocomplete, and analytics' },
    { name: 'Debugging', description: 'Admin-only request capture and replay tools' },
    { name: 'Gamification', description: 'Points, leaderboards, and tier rewards' },
    { name: 'Data Pipeline', description: 'ETL jobs and data warehouse operations' },
    { name: 'Sharding', description: 'Database shard management and migrations' },
  ],
  paths: {
    '/': {
      get: {
        tags: ['App'],
        summary: 'Get app status',
        operationId: 'getAppStatus',
        responses: {
          200: response(200, 'App is running', {
            message: 'TeachLink API is running',
            timestamp: '2026-05-27T18:00:00.000Z',
          }),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        operationId: 'registerUser',
        requestBody: requestBody('#/components/schemas/RegisterRequest', {
          email: 'learner@example.com',
          password: 'Password123!',
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: 'student',
        }),
        responses: {
          201: response(
            201,
            'Registration successful',
            successEnvelope(examples.user, 'Registration successful'),
          ),
          400: response(
            400,
            'Invalid registration data',
            errorEnvelope('Validation failed', 'email'),
            '#/components/schemas/ApiError',
          ),
          409: response(
            409,
            'Email already exists',
            errorEnvelope('Email already exists'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        operationId: 'loginUser',
        requestBody: requestBody('#/components/schemas/LoginRequest', {
          email: 'learner@example.com',
          password: 'Password123!',
        }),
        responses: {
          200: response(
            200,
            'Login successful',
            successEnvelope(
              {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'refresh_01JZ0D4R8R2Y3R9H2W6E5R4T1P',
                user: examples.user,
              },
              'Login successful',
            ),
          ),
          401: response(
            401,
            'Invalid credentials',
            errorEnvelope('Invalid credentials'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        operationId: 'listUsers',
        security: bearerSecurity,
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
        ],
        responses: {
          200: response(200, 'Users found', successEnvelope([examples.user])),
          401: response(
            401,
            'Authentication required',
            errorEnvelope('Authentication required'),
            '#/components/schemas/ApiError',
          ),
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user',
        operationId: 'createUser',
        security: bearerSecurity,
        requestBody: requestBody('#/components/schemas/RegisterRequest', {
          email: 'teacher@example.com',
          password: 'Password123!',
          firstName: 'Grace',
          lastName: 'Hopper',
          role: 'teacher',
        }),
        responses: {
          201: response(
            201,
            'User created',
            successEnvelope({ ...examples.user, role: 'teacher' }, 'User created'),
          ),
          400: response(
            400,
            'Invalid user data',
            errorEnvelope('Validation failed'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses',
        operationId: 'listCourses',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
        ],
        responses: {
          200: response(200, 'Courses found', successEnvelope([examples.course])),
        },
      },
      post: {
        tags: ['Courses'],
        summary: 'Create a course',
        operationId: 'createCourse',
        security: bearerSecurity,
        requestBody: requestBody('#/components/schemas/CourseRequest', {
          title: examples.course.title,
          description: examples.course.description,
          category: examples.course.category,
          level: examples.course.level,
          price: examples.course.price,
        }),
        responses: {
          201: response(201, 'Course created', successEnvelope(examples.course, 'Course created')),
          400: response(
            400,
            'Invalid course data',
            errorEnvelope('Validation failed', 'title'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/payments/create-intent': {
      post: {
        tags: ['Payments'],
        summary: 'Create a payment intent',
        operationId: 'createPaymentIntent',
        security: bearerSecurity,
        parameters: [
          {
            name: 'X-Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            example: 'payment-8e4fd4f8-d8f3-46b5',
          },
        ],
        requestBody: requestBody('#/components/schemas/PaymentIntentRequest', {
          courseId: examples.course.id,
          amount: 3999,
          currency: 'USD',
        }),
        responses: {
          201: response(
            201,
            'Payment intent created',
            successEnvelope(examples.payment, 'Payment intent created'),
          ),
          409: response(
            409,
            'Duplicate idempotency key',
            errorEnvelope('Request already processed'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/search': {
      get: {
        tags: ['Search'],
        summary: 'Search courses and learning content',
        operationId: 'searchContent',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            example: 'javascript basics',
          },
          {
            name: 'filters',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: '{"category":"programming","level":"beginner"}',
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: 'relevance',
          },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: response(
            200,
            'Search results',
            {
              results: [examples.course],
              total: 1,
              page: 1,
              limit: 20,
              filters: { category: 'programming', level: 'beginner' },
              query: 'javascript basics',
            },
            '#/components/schemas/SearchResponse',
          ),
          400: response(
            400,
            'Invalid filters JSON',
            errorEnvelope('filters must be valid JSON', 'filters'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/search/autocomplete': {
      get: {
        tags: ['Search'],
        summary: 'Get search autocomplete suggestions',
        operationId: 'getAutocomplete',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, example: 'java' },
        ],
        responses: {
          200: response(200, 'Autocomplete suggestions', [
            'javascript',
            'java fundamentals',
            'java spring',
          ]),
        },
      },
    },
    '/debug/requests': {
      get: {
        tags: ['Debugging'],
        summary: 'List recently captured requests',
        operationId: 'listCapturedRequests',
        security: bearerSecurity,
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: response(200, 'Captured request summaries', {
            total: 1,
            records: [
              {
                id: 'req_01',
                timestamp: '2026-05-27T18:00:00.000Z',
                method: 'GET',
                path: '/search?q=javascript',
                statusCode: 200,
                durationMs: 18,
                hasError: false,
              },
            ],
          }),
        },
      },
      delete: {
        tags: ['Debugging'],
        summary: 'Clear the captured request buffer',
        operationId: 'clearCapturedRequests',
        security: bearerSecurity,
        responses: {
          200: response(200, 'Capture buffer cleared', { message: 'Debug capture buffer cleared' }),
        },
      },
    },
    '/gamification/points/award-activity': {
      post: {
        tags: ['Gamification'],
        summary: 'Award points for a user activity',
        operationId: 'awardActivity',
        requestBody: requestBody('#/components/schemas/AwardActivityRequest', {
          userId: 'user_123',
          activityType: 'COURSE_COMPLETED',
        }),
        responses: {
          200: response(
            200,
            'Activity awarded',
            successEnvelope({ pointsAwarded: 500, totalPoints: 2500 }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'activityType'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/gamification/points/add': {
      post: {
        tags: ['Gamification'],
        summary: 'Add points to a user',
        operationId: 'addPoints',
        requestBody: requestBody('#/components/schemas/AddPointsRequest', {
          userId: 'user_123',
          points: 100,
          activityType: 'COURSE_COMPLETED',
        }),
        responses: {
          200: response(
            200,
            'Points added',
            successEnvelope({ pointsAdded: 100, totalPoints: 2600 }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'points'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/gamification/tiers/rewards/{tier}': {
      post: {
        tags: ['Gamification'],
        summary: 'Create or update a tier reward',
        operationId: 'upsertReward',
        parameters: [
          {
            name: 'tier',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] },
            example: 'GOLD',
          },
        ],
        requestBody: requestBody('#/components/schemas/UpsertRewardRequest', {
          title: 'Gold Badge',
          description: 'Awarded for reaching Gold tier',
          badgeId: 'badge_gold',
          bonusPoints: 500,
        }),
        responses: {
          200: response(200, 'Reward saved', successEnvelope({ id: 'reward_001', tier: 'GOLD' })),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'title'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/gamification/points/progress/{userId}': {
      get: {
        tags: ['Gamification'],
        summary: 'Get user progress and points',
        operationId: 'getUserProgress',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'user_123',
          },
        ],
        responses: {
          200: response(
            200,
            'User progress',
            successEnvelope({
              userId: 'user_123',
              totalPoints: 2500,
              tier: 'GOLD',
              pointsToNextTier: 500,
            }),
          ),
        },
      },
    },
    '/gamification/leaderboard': {
      get: {
        tags: ['Gamification'],
        summary: 'Get leaderboard',
        operationId: 'getLeaderboard',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: response(
            200,
            'Leaderboard',
            successEnvelope({
              entries: [{ userId: 'user_123', rank: 1, points: 2500 }],
              page: 1,
              pageSize: 20,
              total: 1,
            }),
          ),
        },
      },
    },
    '/data-pipeline/etl/run': {
      post: {
        tags: ['Data Pipeline'],
        summary: 'Run an ETL job',
        operationId: 'runEtl',
        requestBody: requestBody('#/components/schemas/RunEtlRequest', {
          source: 'sales_csv',
          data: [{ id: 1, name: 'example' }],
        }),
        responses: {
          200: response(
            200,
            'ETL job completed',
            successEnvelope({ recordsProcessed: 1000, durationMs: 1500 }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'source'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/sharding/route': {
      post: {
        tags: ['Sharding'],
        summary: 'Resolve which shard a key routes to',
        operationId: 'routeShard',
        requestBody: requestBody('#/components/schemas/RouteShardRequest', {
          key: 'user_123',
          strategy: 'hash_based',
          forRead: false,
        }),
        responses: {
          200: response(
            200,
            'Routing result',
            successEnvelope({
              shardId: 'shard-01',
              host: 'db-shard-01.example.com',
              port: 5432,
              isReplica: false,
              routingKey: 'user_123',
              resolutionTimeMs: 2,
            }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'key'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/sharding/migrations': {
      post: {
        tags: ['Sharding'],
        summary: 'Start a cross-shard data migration',
        operationId: 'startMigration',
        requestBody: requestBody('#/components/schemas/StartMigrationRequest', {
          sourceShardId: 'shard-00',
          targetShardId: 'shard-01',
          entityType: 'users',
          estimatedRowCount: 50000,
          batchSize: 1000,
          dryRun: false,
        }),
        responses: {
          202: response(
            202,
            'Migration started',
            successEnvelope({ planId: 'plan_001', message: 'Migration started' }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'sourceShardId'),
            '#/components/schemas/ApiError',
          ),
        },
      },
      get: {
        tags: ['Sharding'],
        summary: 'List all migration plans and their statuses',
        operationId: 'listMigrations',
        responses: {
          200: response(
            200,
            'Migration plans',
            successEnvelope({ migrations: [{ planId: 'plan_001', status: 'running' }] }),
          ),
        },
      },
    },
    '/sharding/migrations/{planId}': {
      get: {
        tags: ['Sharding'],
        summary: 'Get the status of a specific migration plan',
        operationId: 'getMigrationStatus',
        parameters: [
          {
            name: 'planId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'plan_001',
          },
        ],
        responses: {
          200: response(
            200,
            'Migration status',
            successEnvelope({
              planId: 'plan_001',
              status: 'running',
              migratedRows: 10000,
              totalRows: 50000,
            }),
          ),
        },
      },
      delete: {
        tags: ['Sharding'],
        summary: 'Roll back a completed migration',
        operationId: 'rollbackMigration',
        parameters: [
          {
            name: 'planId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'plan_001',
          },
        ],
        responses: {
          200: response(
            200,
            'Migration rolled back',
            successEnvelope({ message: 'Migration "plan_001" rolled back' }),
          ),
        },
      },
    },
    '/sharding/rebalance': {
      post: {
        tags: ['Sharding'],
        summary: 'Trigger a manual shard rebalance',
        operationId: 'manualRebalance',
        requestBody: requestBody('#/components/schemas/ManualRebalanceRequest', {
          migrations: [
            {
              sourceShardId: 'shard-00',
              targetShardId: 'shard-01',
              entityType: 'users',
              estimatedRowCount: 50000,
              batchSize: 1000,
              dryRun: false,
            },
          ],
          dryRun: false,
        }),
        responses: {
          202: response(
            202,
            'Rebalance plan created',
            successEnvelope({ planId: 'plan_002', plan: {} }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'migrations'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
    '/sharding/rebalance/auto': {
      post: {
        tags: ['Sharding'],
        summary: 'Run automated rebalance analysis',
        operationId: 'autoRebalance',
        requestBody: requestBody('#/components/schemas/AutoRebalanceRequest', {
          entityTypes: ['users', 'courses'],
          autoExecute: false,
        }),
        responses: {
          202: response(
            202,
            'Auto-rebalance plan created',
            successEnvelope({ planId: 'plan_003', plan: {} }),
          ),
          400: response(
            400,
            'Invalid request',
            errorEnvelope('Validation failed', 'entityTypes'),
            '#/components/schemas/ApiError',
          ),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas,
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function generateExamplesMarkdown() {
  const curls = [
    {
      title: 'Login',
      command: [
        'curl -X POST http://localhost:3000/auth/login \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '${JSON.stringify({ email: 'learner@example.com', password: 'Password123!' })}'`,
      ].join('\n'),
      response: successEnvelope(
        {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'refresh_01JZ0D4R8R2Y3R9H2W6E5R4T1P',
          user: examples.user,
        },
        'Login successful',
      ),
    },
    {
      title: 'Create Course',
      command: [
        'curl -X POST http://localhost:3000/courses \\',
        '  -H "Authorization: Bearer YOUR_TOKEN" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '${JSON.stringify({
          title: examples.course.title,
          description: examples.course.description,
          category: examples.course.category,
          level: examples.course.level,
          price: examples.course.price,
        })}'`,
      ].join('\n'),
      response: successEnvelope(examples.course, 'Course created'),
    },
    {
      title: 'Search Content',
      command:
        'curl "http://localhost:3000/search?q=javascript%20basics&filters=%7B%22category%22%3A%22programming%22%7D"',
      response: {
        results: [examples.course],
        total: 1,
        page: 1,
        limit: 20,
        filters: { category: 'programming' },
        query: 'javascript basics',
      },
    },
  ];

  return [
    '# API Examples',
    '',
    'This file is generated by `npm run docs:generate` from `scripts/generate-api-docs.js`.',
    '',
    ...curls.flatMap((item) => [
      `## ${item.title}`,
      '',
      '```bash',
      item.command,
      '```',
      '',
      '```json',
      json(item.response),
      '```',
      '',
    ]),
  ].join('\n');
}

function generateSiteHtml() {
  const operations = Object.entries(spec.paths).flatMap(([route, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ route, method, operation })),
  );

  const rows = operations
    .map(
      ({ route, method, operation }) => `
        <tr>
          <td><span class="method method-${method}">${method.toUpperCase()}</span></td>
          <td><code>${route}</code></td>
          <td>${operation.summary}</td>
          <td>${operation.tags.join(', ')}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TeachLink API Documentation</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">Generated API Docs</p>
      <h1>TeachLink API</h1>
      <p>OpenAPI ${spec.openapi} documentation generated from the backend documentation source.</p>
      <div class="actions">
        <a href="./openapi-spec.json">Download OpenAPI JSON</a>
        <a href="./examples.md">View Examples</a>
      </div>
    </section>
    <section>
      <h2>Endpoints</h2>
      <table>
        <thead>
          <tr><th>Method</th><th>Path</th><th>Summary</th><th>Tags</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    <section>
      <h2>Interactive Reference</h2>
      <redoc spec-url="./openapi-spec.json"></redoc>
    </section>
  </main>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
}

function generateStyles() {
  return `:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #172026;
  background: #f8faf9;
}

body {
  margin: 0;
}

main {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 80px;
}

.hero {
  padding: 48px 0 32px;
  border-bottom: 1px solid #d9e2df;
}

.eyebrow {
  color: #0d7a61;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.78rem;
}

h1 {
  margin: 0;
  font-size: 3rem;
  letter-spacing: 0;
}

h2 {
  margin-top: 40px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.actions a {
  border: 1px solid #0d7a61;
  color: #0b5f4d;
  padding: 10px 14px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 700;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border: 1px solid #d9e2df;
}

th, td {
  padding: 12px;
  border-bottom: 1px solid #e5ece9;
  text-align: left;
  vertical-align: top;
}

th {
  background: #edf4f1;
}

code {
  white-space: nowrap;
}

.method {
  display: inline-block;
  min-width: 56px;
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  font-weight: 800;
  text-align: center;
  font-size: 0.78rem;
}

.method-get { background: #2563eb; }
.method-post { background: #0d7a61; }
.method-put { background: #b45309; }
.method-patch { background: #7c3aed; }
.method-delete { background: #dc2626; }
`;
}

function main() {
  ensureDir(apiDocsDir);
  ensureDir(siteDir);

  const specJson = json(spec);
  writeFile(path.join(rootDir, 'openapi-spec.json'), `${specJson}\n`);
  writeFile(path.join(apiDocsDir, 'openapi-spec.json'), `${specJson}\n`);
  writeFile(path.join(apiDocsDir, 'examples.md'), generateExamplesMarkdown());
  writeFile(path.join(siteDir, 'openapi-spec.json'), `${specJson}\n`);
  writeFile(path.join(siteDir, 'examples.md'), generateExamplesMarkdown());
  writeFile(path.join(siteDir, 'index.html'), generateSiteHtml());
  writeFile(path.join(siteDir, 'styles.css'), generateStyles());
  writeFile(path.join(siteDir, '.nojekyll'), '');

  console.log(`Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths.`);
  console.log(`Wrote ${path.relative(rootDir, path.join(siteDir, 'index.html'))}`);
}

main();
