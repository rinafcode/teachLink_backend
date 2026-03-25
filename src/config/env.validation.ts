import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  PORT: Joi.number().default(3000),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(30),
  DATABASE_POOL_MIN: Joi.number().integer().min(0).default(5),
  DATABASE_POOL_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),

  JWT_SECRET: Joi.string().min(10).required(),
  ENCRYPTION_SECRET: Joi.string().min(32).required(),
});
