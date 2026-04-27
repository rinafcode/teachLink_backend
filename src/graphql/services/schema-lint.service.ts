import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { buildSchema, validateSchema } from 'graphql';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ILintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class SchemaLintService implements OnModuleInit {
  private readonly logger = new Logger(SchemaLintService.name);

  onModuleInit() {
    const result = this.lintSchema();
    if (!result.valid) {
      this.logger.error('❌ GraphQL schema validation failed on startup');
    }
  }

  lintSchema(): ILintResult {
    const result: ILintResult = { valid: true, errors: [], warnings: [] };
    const schemaPath = join(process.cwd(), 'src/graphql/schema/schema.graphql');

    if (!existsSync(schemaPath)) {
      result.valid = false;
      result.errors.push(`Schema file not found at: ${schemaPath}`);
      this.logger.error(`Schema file not found at: ${schemaPath}`);
      return result;
    }

    try {
      const schemaString = readFileSync(schemaPath, 'utf-8');
      const schema = buildSchema(schemaString);
      const errors = validateSchema(schema);

      if (errors.length > 0) {
        result.valid = false;
        result.errors = errors.map((e) => e.message);
        errors.forEach((e) => this.logger.error(`Schema error: ${e.message}`));
      } else {
        this.logger.log('✅ GraphQL schema passed structural validation');
      }

      this.checkNamingConventions(schemaString, result);
      this.checkDeprecatedFields(schemaString, result);
      this.checkMissingDescriptions(schemaString, result);
    } catch (err) {
      result.valid = false;
      result.errors.push(`Schema parsing failed: ${err.message}`);
      this.logger.error(`Schema parsing failed: ${err.message}`);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => this.logger.warn(w));
    }

    return result;
  }

  private checkNamingConventions(schemaString: string, result: ILintResult): void {
    // Types must be PascalCase
    const lowercaseTypes = [...schemaString.matchAll(/^type\s+([a-z][a-zA-Z0-9]*)/gm)];
    for (const match of lowercaseTypes) {
      result.warnings.push(`Type "${match[1]}" should use PascalCase naming`);
    }

    // Fields must be camelCase (starts with uppercase = violation)
    const uppercaseFields = [...schemaString.matchAll(/^\s{2,}([A-Z][a-zA-Z0-9]*)(\(|:)/gm)];
    for (const match of uppercaseFields) {
      result.warnings.push(`Field "${match[1]}" should use camelCase naming`);
    }
  }

  private checkDeprecatedFields(schemaString: string, result: ILintResult): void {
    const deprecated = [...schemaString.matchAll(/@deprecated/g)];
    if (deprecated.length > 0) {
      result.warnings.push(
        `Found ${deprecated.length} @deprecated directive(s) — review before removal`,
      );
    }
  }

  private checkMissingDescriptions(schemaString: string, result: ILintResult): void {
    // Types without a description comment above them
    const typesWithoutDesc = [...schemaString.matchAll(/^type\s+(\w+)/gm)];
    for (const match of typesWithoutDesc) {
      const typeIndex = schemaString.indexOf(match[0]);
      const before = schemaString.slice(Math.max(0, typeIndex - 50), typeIndex);
      if (!before.includes('"""') && !before.includes('#')) {
        result.warnings.push(`Type "${match[1]}" is missing a description`);
      }
    }
  }
}
