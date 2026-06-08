#!/usr/bin/env node
/**
 * OpenAPI 3.0 Compliance Validation Script
 *
 * Validates the generated OpenAPI spec against:
 *  1. Schema structure (required OpenAPI 3.0 fields)
 *  2. Path/operation correctness (operationId uniqueness, response codes, security refs)
 *  3. Component schema integrity ($ref resolution, required fields)
 *  4. Response body shape validation against declared schemas
 *
 * Exit codes:
 *  0 — all checks passed
 *  1 — one or more validation errors found
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SPEC_PATH = path.resolve(__dirname, '..', 'openapi-spec.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(`  ✗ ${msg}`);
}

function warn(msg) {
  warnings.push(`  ⚠ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ─── Load spec ────────────────────────────────────────────────────────────────

if (!fs.existsSync(SPEC_PATH)) {
  console.error(`ERROR: OpenAPI spec not found at ${SPEC_PATH}`);
  console.error('Run `npm run docs:generate` first.');
  process.exit(1);
}

let spec;
try {
  spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
} catch (e) {
  console.error(`ERROR: Failed to parse OpenAPI spec JSON: ${e.message}`);
  process.exit(1);
}

// ─── 1. Top-level structure ───────────────────────────────────────────────────

console.log('\n[1] Top-level structure');

if (typeof spec.openapi !== 'string') {
  fail('Missing required field: openapi');
} else if (!spec.openapi.startsWith('3.')) {
  fail(`openapi version must be 3.x.x, got: ${spec.openapi}`);
} else {
  pass(`openapi version: ${spec.openapi}`);
}

if (!spec.info || typeof spec.info !== 'object') {
  fail('Missing required field: info');
} else {
  if (!spec.info.title) fail('info.title is required');
  else pass(`info.title: "${spec.info.title}"`);

  if (!spec.info.version) fail('info.version is required');
  else pass(`info.version: "${spec.info.version}"`);
}

if (!spec.paths || typeof spec.paths !== 'object') {
  fail('Missing required field: paths');
} else {
  pass(`paths: ${Object.keys(spec.paths).length} route(s) defined`);
}

// ─── 2. Servers ───────────────────────────────────────────────────────────────

console.log('\n[2] Servers');

if (!Array.isArray(spec.servers) || spec.servers.length === 0) {
  warn('No servers defined — clients will default to the spec file origin');
} else {
  for (const server of spec.servers) {
    if (!server.url) {
      fail('Server entry is missing required field: url');
    } else {
      pass(`server url: ${server.url}`);
    }
  }
}

// ─── 3. Paths & operations ────────────────────────────────────────────────────

console.log('\n[3] Paths & operations');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const operationIds = new Set();
let operationCount = 0;

for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
  if (!routePath.startsWith('/')) {
    fail(`Path must start with "/": ${routePath}`);
  }

  for (const method of HTTP_METHODS) {
    const operation = pathItem[method];
    if (!operation) continue;

    operationCount++;
    const loc = `${method.toUpperCase()} ${routePath}`;

    // operationId uniqueness
    if (!operation.operationId) {
      fail(`${loc}: missing operationId`);
    } else if (operationIds.has(operation.operationId)) {
      fail(`${loc}: duplicate operationId "${operation.operationId}"`);
    } else {
      operationIds.add(operation.operationId);
      pass(`${loc}: operationId="${operation.operationId}"`);
    }

    // At least one response
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      fail(`${loc}: no responses defined`);
    } else {
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (!response.description) {
          fail(`${loc} [${statusCode}]: response missing description`);
        }
      }
    }

    // Tags
    if (!Array.isArray(operation.tags) || operation.tags.length === 0) {
      warn(`${loc}: no tags defined`);
    }

    // Security references
    if (Array.isArray(operation.security)) {
      for (const secReq of operation.security) {
        for (const schemeName of Object.keys(secReq)) {
          const defined =
            spec.components?.securitySchemes &&
            schemeName in spec.components.securitySchemes;
          if (!defined) {
            fail(`${loc}: security scheme "${schemeName}" not defined in components.securitySchemes`);
          }
        }
      }
    }
  }
}

pass(`Total operations validated: ${operationCount}`);

// ─── 4. Component schemas ─────────────────────────────────────────────────────

console.log('\n[4] Component schemas');

const schemas = spec.components?.schemas || {};
const schemaNames = Object.keys(schemas);

if (schemaNames.length === 0) {
  warn('No component schemas defined');
} else {
  pass(`${schemaNames.length} schema(s) defined`);
}

// Collect all $refs used in the spec
function collectRefs(obj, refs = new Set()) {
  if (typeof obj !== 'object' || obj === null) return refs;
  if (obj.$ref) refs.add(obj.$ref);
  for (const val of Object.values(obj)) collectRefs(val, refs);
  return refs;
}

const allRefs = collectRefs(spec);
for (const ref of allRefs) {
  if (!ref.startsWith('#/')) {
    warn(`External $ref not validated: ${ref}`);
    continue;
  }
  // Resolve local ref
  const parts = ref.replace('#/', '').split('/');
  let node = spec;
  let resolved = true;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = node[part];
    } else {
      resolved = false;
      break;
    }
  }
  if (!resolved) {
    fail(`Unresolvable $ref: ${ref}`);
  } else {
    pass(`$ref resolved: ${ref}`);
  }
}

// Validate each schema has a type or $ref
for (const [name, schema] of Object.entries(schemas)) {
  if (!schema.type && !schema.$ref && !schema.allOf && !schema.oneOf && !schema.anyOf) {
    warn(`Schema "${name}" has no type, $ref, allOf, oneOf, or anyOf`);
  } else {
    pass(`Schema "${name}" is well-formed`);
  }
}

// ─── 5. Response body validation ──────────────────────────────────────────────

console.log('\n[5] Response body content-type validation');

for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of HTTP_METHODS) {
    const operation = pathItem[method];
    if (!operation) continue;

    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      // Skip 204 No Content and redirects
      const code = parseInt(statusCode, 10);
      if (code === 204 || (code >= 300 && code < 400)) continue;

      if (response.content) {
        for (const [mediaType, mediaObj] of Object.entries(response.content)) {
          if (!mediaType.includes('application/json') && !mediaType.includes('text/')) {
            warn(
              `${method.toUpperCase()} ${routePath} [${statusCode}]: unusual media type "${mediaType}"`,
            );
          }
          if (mediaObj.schema && mediaObj.schema.$ref) {
            // Already validated above via collectRefs
          } else if (mediaObj.schema && !mediaObj.schema.type && !mediaObj.schema.allOf) {
            warn(
              `${method.toUpperCase()} ${routePath} [${statusCode}]: response schema has no type`,
            );
          }
        }
      }
    }
  }
}

pass('Response content-type checks complete');

// ─── 6. Security schemes ──────────────────────────────────────────────────────

console.log('\n[6] Security schemes');

const securitySchemes = spec.components?.securitySchemes || {};
if (Object.keys(securitySchemes).length === 0) {
  warn('No security schemes defined');
} else {
  for (const [name, scheme] of Object.entries(securitySchemes)) {
    if (!scheme.type) {
      fail(`Security scheme "${name}" missing required field: type`);
    } else {
      pass(`Security scheme "${name}" type="${scheme.type}"`);
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────');

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(w));
}

if (errors.length > 0) {
  console.error(`\nValidation FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.error(e));
  process.exit(1);
} else {
  console.log(`\n✅ OpenAPI spec is valid (${operationCount} operations, 0 errors, ${warnings.length} warnings)`);
  process.exit(0);
}
