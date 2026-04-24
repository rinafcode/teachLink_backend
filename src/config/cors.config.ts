import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS configuration for the TeachLink API.
 * This configuration restricts access to specific origins, methods, and headers
 * to enhance security, especially in production environments.
 */
export const corsConfig: CorsOptions = {
  /**
   * Defines the allowed origins for CORS requests.
   * In production, this should be restricted to specific frontend domains.
   * If CORS_ALLOWED_ORIGINS is not set, it defaults to common local development ports.
   */
  origin: (origin, callback) => {
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;
    
    // Default allowed origins if none are configured
    const defaultOrigins = ['http://localhost:3000', 'http://localhost:4000'];
    
    const allowedOrigins = rawOrigins
      ? rawOrigins.split(',').map((o) => o.trim()).filter((o) => o !== '')
      : defaultOrigins;

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },

  /**
   * Restricts allowed HTTP methods.
   */
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],

  /**
   * Restricts allowed headers.
   * Includes common headers and custom correlation ID headers.
   */
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Requested-With',
    'X-HTTP-Method-Override',
    'x-request-id',
    'x-correlation-id',
  ],

  /**
   * Allows credentials (cookies, authorization headers) to be sent.
   */
  credentials: true,

  /**
   * Configures how long the results of a preflight request can be cached.
   */
  maxAge: 3600,
};
