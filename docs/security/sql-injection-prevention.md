# SQL Injection Prevention & Query Best Practices Guide

This document outlines the architectural standards and implementation guidelines to prevent SQL Injection (SQLi) vulnerabilities in the TeachLink backend.

---

## 1. TypeORM Query Builder Best Practices

When building queries using TypeORM's `QueryBuilder`, **never** concatenate or interpolate variables directly into the query string. Always use parameter placeholders and bind the values using the parameters object.

### ❌ Vulnerable (Direct Interpolation)
```typescript
// DANGEROUS: Allows SQL Injection if query is malicious
const courses = await courseRepository
  .createQueryBuilder('course')
  .where(`course.title ILIKE '%${query}%'`)
  .getMany();
```

### ✅ Secure (Parameterized Query)
```typescript
// SAFE: Parameterized placeholders (:query)
const courses = await courseRepository
  .createQueryBuilder('course')
  .where('course.title ILIKE :query', { query: `%${query}%` })
  .getMany();
```

---

## 2. Parameterizing Raw SQL Queries

When execution of raw SQL queries is necessary (e.g. using `dataSource.query` or `manager.query`), you must always use parameter placeholders (`$1`, `$2` for PostgreSQL) and pass parameters in an array.

### ❌ Vulnerable (Direct Interpolation)
```typescript
// DANGEROUS: Executes raw input strings
const result = await dataSource.query(
  `SELECT * FROM courses WHERE price >= ${minPrice}`
);
```

### ✅ Secure (Parameterized Array)
```typescript
// SAFE: Uses postgres placeholders and passes values separately
const result = await dataSource.query(
  'SELECT * FROM courses WHERE price >= $1',
  [minPrice]
);
```

---

## 3. Dynamic SQL Identifiers (Table & Column Names)

In rare cases where identifiers like table names, column names, or savepoint names must be dynamic (since SQL parameters cannot bind to identifiers), you must run strict validation against a whitelist regex:

### Whitelist Regex Validation
* **Pattern**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
* **Rule**: Throw a validation error immediately if the identifier does not match this pattern.

### ✅ Secure Identifier Validation Pattern
```typescript
function validateSqlIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new BadRequestException(`Invalid database identifier: ${name}`);
  }
}

// Inside migration or transaction helper:
validateSqlIdentifier(tableName);
await manager.query(`SELECT * FROM "${tableName}"`);
```

---

## 4. Escaping Wildcard Characters in LIKE/ILIKE

When querying using `LIKE` or `ILIKE` operators, users can pass special wildcard characters (`%` or `_`) to alter the query logic. To prevent wildcard abuse, use the `sanitizeSqlLike` utility:

```typescript
import { sanitizeSqlLike } from '../common/utils/sanitization.utils';

const safeQuery = sanitizeSqlLike(query);

await tenantRepository
  .createQueryBuilder('tenant')
  .where("tenant.name ILIKE :query ESCAPE '\\'", { query: `%${safeQuery}%` })
  .getMany();
```

---

## 5. Security Checklist for Code Reviews

* [ ] No template strings or `+` concatenations are present inside `where()`, `andWhere()`, or `orWhere()` clauses.
* [ ] No raw queries are executed using interpolated templates (e.g., `dataSource.query("SELECT ... ${var}")`).
* [ ] Any custom table names, column names, or transaction savepoint names are validated using the identifier regex pattern `/^[a-zA-Z_][a-zA-Z0-9_]*$/`.
* [ ] Transaction timeouts are validated as positive integer numbers before execution.
* [ ] User searches matching standard text are sanitized using `sanitizeSqlLike` and utilize the `ESCAPE '\\'` operator.
