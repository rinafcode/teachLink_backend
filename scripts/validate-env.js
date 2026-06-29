#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * 
 * Validates that all required environment variables are set and contain valid values.
 * Provides detailed feedback on missing or invalid configurations.
 * 
 * Usage:
 *   npm run validate:env          # Validate against .env.example
 *   node scripts/validate-env.js  # Direct execution
 */

const path = require('path');
const fs = require('fs');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

// Environment variable specifications
const ENV_SPEC = {
  // ============ REQUIRED VARIABLES ============
  // Core Database
  DATABASE_HOST: {
    required: true,
    type: 'string',
    description: 'PostgreSQL primary database host',
  },
  DATABASE_PORT: {
    required: true,
    type: 'integer',
    min: 1,
    max: 65535,
    description: 'PostgreSQL port',
  },
  DATABASE_USER: {
    required: true,
    type: 'string',
    description: 'PostgreSQL username',
  },
  DATABASE_PASSWORD: {
    required: true,
    type: 'string',
    description: 'PostgreSQL password',
  },
  DATABASE_NAME: {
    required: true,
    type: 'string',
    description: 'PostgreSQL database name',
  },

  // Authentication
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 10,
    description: 'JWT signing secret (min 32 chars recommended)',
  },
  JWT_REFRESH_SECRET: {
    required: true,
    type: 'string',
    minLength: 10,
    description: 'JWT refresh secret (min 32 chars recommended)',
  },
  ENCRYPTION_SECRET: {
    required: true,
    type: 'string',
    length: 32,
    description: 'Encryption secret (exactly 32 characters)',
  },

  // Session
  SESSION_SECRET: {
    required: true,
    type: 'string',
    minLength: 10,
    description: 'Session encryption secret',
  },

  // Redis
  REDIS_HOST: {
    required: true,
    type: 'string',
    description: 'Redis server host',
  },
  REDIS_PORT: {
    required: true,
    type: 'integer',
    min: 1,
    max: 65535,
    description: 'Redis port',
  },

  // SMTP
  SMTP_HOST: {
    required: true,
    type: 'string',
    description: 'SMTP server host',
  },
  SMTP_PORT: {
    required: true,
    type: 'integer',
    min: 1,
    max: 65535,
    description: 'SMTP port',
  },
  SMTP_USER: {
    required: true,
    type: 'string',
    description: 'SMTP username',
  },
  SMTP_PASS: {
    required: true,
    type: 'string',
    description: 'SMTP password',
  },
  EMAIL_FROM: {
    required: true,
    type: 'email',
    description: 'Default from email address',
  },

  // AWS
  AWS_ACCESS_KEY_ID: {
    required: true,
    type: 'string',
    description: 'AWS access key',
  },
  AWS_SECRET_ACCESS_KEY: {
    required: true,
    type: 'string',
    description: 'AWS secret key',
  },
  AWS_S3_BUCKET: {
    required: true,
    type: 'string',
    description: 'S3 bucket name',
  },

  // Stripe
  STRIPE_SECRET_KEY: {
    required: true,
    type: 'string',
    description: 'Stripe secret API key',
  },
  STRIPE_WEBHOOK_SECRET: {
    required: true,
    type: 'string',
    description: 'Stripe webhook signing secret',
  },

  // SendGrid
  SENDGRID_API_KEY: {
    required: true,
    type: 'string',
    description: 'SendGrid API key',
  },

  // ============ OPTIONAL VARIABLES (WITH DEFAULTS) ============
  NODE_ENV: {
    required: false,
    type: 'string',
    enum: ['development', 'production', 'test', 'staging'],
    default: 'development',
    description: 'Environment mode',
  },
  PORT: {
    required: false,
    type: 'integer',
    min: 1,
    max: 65535,
    default: 3000,
    description: 'Application port',
  },
  APP_URL: {
    required: false,
    type: 'url',
    default: 'http://localhost:3000',
    description: 'Public application URL',
  },
  AWS_REGION: {
    required: false,
    type: 'string',
    default: 'us-east-1',
    description: 'AWS region',
  },
  DATABASE_POOL_MAX: {
    required: false,
    type: 'integer',
    min: 1,
    default: 30,
    description: 'Max database connections',
  },
  DATABASE_POOL_MIN: {
    required: false,
    type: 'integer',
    min: 0,
    default: 5,
    description: 'Min database connections',
  },
  BCRYPT_ROUNDS: {
    required: false,
    type: 'integer',
    min: 4,
    max: 15,
    default: 10,
    description: 'Bcrypt hashing rounds',
  },
  JWT_EXPIRES_IN: {
    required: false,
    type: 'string',
    default: '15m',
    description: 'JWT expiration time',
  },
  JWT_REFRESH_EXPIRES_IN: {
    required: false,
    type: 'string',
    default: '7d',
    description: 'Refresh token expiration',
  },
  CLUSTER_MODE: {
    required: false,
    type: 'boolean',
    default: false,
    description: 'Enable cluster mode',
  },
  TRUST_PROXY: {
    required: false,
    type: 'boolean',
    default: true,
    description: 'Trust proxy headers',
  },
  SESSION_TTL_SECONDS: {
    required: false,
    type: 'integer',
    min: 60,
    default: 604800,
    description: 'Session TTL in seconds',
  },
  ELASTICSEARCH_NODE: {
    required: false,
    type: 'url',
    default: 'http://localhost:9200',
    description: 'Elasticsearch endpoint',
  },
  METRICS_ENABLED: {
    required: false,
    type: 'boolean',
    default: true,
    description: 'Enable metrics endpoint',
  },
};

// Validation functions
const validators = {
  string: (value) => typeof value === 'string' && value.length > 0,
  integer: (value) => Number.isInteger(parseInt(value, 10)),
  boolean: (value) => value === 'true' || value === 'false',
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  url: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};

function validateValue(value, spec) {
  const errors = [];

  if (value === undefined || value === '') {
    if (spec.required) {
      errors.push('Value is required but not set');
    }
    return errors;
  }

  // Type validation
  if (!validators[spec.type] || !validators[spec.type](value)) {
    errors.push(`Invalid ${spec.type} format`);
    return errors; // Skip further validation if type is wrong
  }

  // Enum validation
  if (spec.enum && !spec.enum.includes(value)) {
    errors.push(`Must be one of: ${spec.enum.join(', ')}`);
  }

  // Length validation
  if (spec.length && value.length !== spec.length) {
    errors.push(`Must be exactly ${spec.length} characters`);
  }

  // Min length
  if (spec.minLength && value.length < spec.minLength) {
    errors.push(`Must be at least ${spec.minLength} characters (current: ${value.length})`);
  }

  // Range validation
  if (spec.type === 'integer') {
    const num = parseInt(value, 10);
    if (spec.min !== undefined && num < spec.min) {
      errors.push(`Must be >= ${spec.min}`);
    }
    if (spec.max !== undefined && num > spec.max) {
      errors.push(`Must be <= ${spec.max}`);
    }
  }

  return errors;
}

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    env[key.trim()] = value.trim();
  }

  return env;
}

function validateEnvironment() {
  const startTime = Date.now();
  const env = process.env;

  // Load from .env file if it exists
  const envFilePath = path.join(process.cwd(), '.env');
  const envFileContent = fs.existsSync(envFilePath) ? loadEnvFile(envFilePath) : {};

  // Merge file env with process.env (process.env takes precedence)
  const mergedEnv = { ...envFileContent, ...env };

  const results = {
    required: [],
    optional: [],
    warnings: [],
    errors: [],
  };

  let hasErrors = false;

  // Validate each spec
  for (const [key, spec] of Object.entries(ENV_SPEC)) {
    const value = mergedEnv[key];
    const validationErrors = validateValue(value, spec);

    const result = {
      key,
      value: value === undefined ? '<not set>' : value.substring(0, 20) + (value.length > 20 ? '...' : ''),
      description: spec.description,
      spec,
      errors: validationErrors,
    };

    if (spec.required) {
      results.required.push(result);
      if (validationErrors.length > 0) {
        hasErrors = true;
      }
    } else {
      results.optional.push(result);
    }
  }

  // Production-specific checks
  if (mergedEnv.NODE_ENV === 'production') {
    if ((mergedEnv.ENCRYPTION_SECRET || '').length < 32) {
      results.warnings.push('ENCRYPTION_SECRET should be 32+ characters in production');
    }
    if ((mergedEnv.JWT_SECRET || '').length < 32) {
      results.warnings.push('JWT_SECRET should be 32+ characters in production');
    }
    if (mergedEnv.CLUSTER_MODE !== 'true') {
      results.warnings.push('Consider enabling CLUSTER_MODE for better resource utilization');
    }
    if (mergedEnv.TRUST_PROXY !== 'true') {
      results.warnings.push('TRUST_PROXY should be enabled when behind a reverse proxy');
    }
  }

  // Print results
  console.log('\n' + colorize('═══════════════════════════════════════════════════════', colors.blue));
  console.log(colorize('   Environment Variables Validation Report', colors.blue));
  console.log(colorize('═══════════════════════════════════════════════════════', colors.blue) + '\n');

  // Summary
  const requiredPassed = results.required.filter((r) => r.errors.length === 0).length;
  const requiredTotal = results.required.length;
  const optionalPassed = results.optional.filter((r) => r.errors.length === 0).length;
  const optionalTotal = results.optional.length;

  console.log(colorize('Summary:', colors.cyan));
  console.log(`  Required:  ${requiredPassed}/${requiredTotal}`);
  console.log(`  Optional:  ${optionalPassed}/${optionalTotal}`);
  console.log();

  // Required variables
  console.log(colorize('📋 Required Variables:', colors.cyan));
  for (const result of results.required) {
    if (result.errors.length === 0) {
      console.log(colorize(`  ✓ ${result.key}`, colors.green));
    } else {
      console.log(colorize(`  ✗ ${result.key}`, colors.red));
      for (const error of result.errors) {
        console.log(colorize(`      → ${error}`, colors.red));
      }
    }
  }
  console.log();

  // Optional variables (show only if set)
  const setOptional = results.optional.filter((r) => mergedEnv[r.key] !== undefined);
  if (setOptional.length > 0) {
    console.log(colorize('⚙️  Optional Variables (Configured):', colors.cyan));
    for (const result of setOptional) {
      if (result.errors.length === 0) {
        const defaultMarker = result.spec.default ? ' (set to default)' : '';
        console.log(colorize(`  ✓ ${result.key}${defaultMarker}`, colors.green));
      } else {
        console.log(colorize(`  ⚠ ${result.key}`, colors.yellow));
        for (const error of result.errors) {
          console.log(colorize(`      → ${error}`, colors.yellow));
        }
      }
    }
    console.log();
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(colorize('⚠️  Warnings:', colors.yellow));
    for (const warning of results.warnings) {
      console.log(colorize(`  • ${warning}`, colors.yellow));
    }
    console.log();
  }

  // Status
  if (hasErrors) {
    console.log(colorize('❌ Validation Failed', colors.red));
    console.log(colorize(`   ${results.required.filter((r) => r.errors.length > 0).length} required variables have errors`, colors.red));
  } else {
    console.log(colorize('✅ Validation Passed', colors.green));
    console.log(colorize('   All required variables are properly configured', colors.green));
  }

  // Footer with next steps
  console.log();
  console.log(colorize('───────────────────────────────────────────────────────', colors.blue));
  if (hasErrors) {
    console.log('Next steps:');
    console.log('  1. Check .env file for missing or invalid values');
    console.log('  2. See ENV_VARS_DOCUMENTATION.md for variable descriptions');
    console.log('  3. Update .env with correct values');
    console.log('  4. Re-run validation: npm run validate:env');
  } else {
    console.log('Your environment is ready for application startup!');
  }
  console.log();

  const duration = Date.now() - startTime;
  console.log(colorize(`Validation completed in ${duration}ms`, colors.gray));

  return !hasErrors;
}

// Run validation
const isValid = validateEnvironment();
process.exit(isValid ? 0 : 1);
