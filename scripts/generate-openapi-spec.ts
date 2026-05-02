import * as fs from 'fs';
import * as path from 'path';

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'TeachLink API',
    description: 'TeachLink Backend API Documentation',
    version: '1.0',
  },
  paths: {
    '/users': {
      get: {
        tags: ['users'],
        summary: 'Get all users (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Users found' },
        },
      },
      post: {
        tags: ['users'],
        summary: 'Create a new user (Admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
                required: ['email', 'password', 'firstName', 'lastName'],
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['users'],
        summary: 'Get user by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User found' },
        },
      },
      patch: {
        tags: ['users'],
        summary: 'Update user',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User updated' },
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete user (Admin only)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User deleted' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'User registration',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
                required: ['email', 'password', 'firstName', 'lastName'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
        },
      },
    },
    '/courses': {
      get: {
        tags: ['courses'],
        summary: 'Get all courses',
        responses: {
          200: { description: 'Courses found' },
        },
      },
      post: {
        tags: ['courses'],
        summary: 'Create a new course',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Course created' },
        },
      },
    },
    '/courses/{id}': {
      get: {
        tags: ['courses'],
        summary: 'Get course by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Course found' },
        },
      },
      patch: {
        tags: ['courses'],
        summary: 'Update course',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Course updated' },
        },
      },
      delete: {
        tags: ['courses'],
        summary: 'Delete course',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Course deleted' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Health check',
        responses: {
          200: { description: 'Service is healthy' },
        },
      },
    },
    '/health/liveness': {
      get: {
        tags: ['health'],
        summary: 'Liveness probe',
        responses: {
          200: { description: 'Service is alive' },
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
  },
};

const outputPath = path.join(__dirname, '../openapi-spec.json');
fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
console.log('OpenAPI spec generated:', outputPath);