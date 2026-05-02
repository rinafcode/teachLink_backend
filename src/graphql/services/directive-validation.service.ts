import { Injectable, Logger } from '@nestjs/common';
import {
  GraphQLSchema,
  GraphQLDirective,
  isObjectType,
  isInterfaceType,
  GraphQLField,
} from 'graphql';

export interface IDirectiveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  directives: string[];
}

@Injectable()
export class DirectiveValidationService {
  private readonly logger = new Logger(DirectiveValidationService.name);

  // Add any custom directives your project uses here
  private readonly KNOWN_CUSTOM_DIRECTIVES = ['auth', 'rateLimit', 'cacheControl', 'deprecated'];

  private readonly BUILT_IN_DIRECTIVES = ['skip', 'include', 'deprecated', 'specifiedBy'];

  validateDirectives(schema: GraphQLSchema): IDirectiveValidationResult {
    const result: IDirectiveValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      directives: [],
    };

    const directives = schema.getDirectives();
    result.directives = directives.map((d) => d.name);

    this.validateBuiltInDirectives(directives, result);
    this.validateCustomDirectives(directives, result);
    this.validateDirectiveUsageOnFields(schema, result);

    if (result.errors.length > 0) {
      result.valid = false;
      result.errors.forEach((e) => this.logger.error(`Directive error: ${e}`));
    } else {
      this.logger.log(`✅ Directive validation passed. Found: [${result.directives.join(', ')}]`);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => this.logger.warn(`Directive warning: ${w}`));
    }

    return result;
  }

  private validateBuiltInDirectives(
    directives: readonly GraphQLDirective[],
    result: IDirectiveValidationResult,
  ): void {
    const names = directives.map((d) => d.name);
    const required = ['skip', 'include', 'deprecated'];

    for (const req of required) {
      if (!names.includes(req)) {
        result.errors.push(`Missing required built-in directive: @${req}`);
      }
    }
  }

  private validateCustomDirectives(
    directives: readonly GraphQLDirective[],
    result: IDirectiveValidationResult,
  ): void {
    for (const directive of directives) {
      if (this.BUILT_IN_DIRECTIVES.includes(directive.name)) continue;

      if (directive.locations.length === 0) {
        result.errors.push(`Custom directive @${directive.name} has no valid locations defined`);
        continue;
      }

      if (!directive.description) {
        result.warnings.push(`Custom directive @${directive.name} is missing a description`);
      }

      this.logger.log(
        `Custom directive @${directive.name} — locations: [${directive.locations.join(', ')}]`,
      );
    }
  }

  private validateDirectiveUsageOnFields(
    schema: GraphQLSchema,
    result: IDirectiveValidationResult,
  ): void {
    const typeMap = schema.getTypeMap();
    const allKnown = [...this.BUILT_IN_DIRECTIVES, ...this.KNOWN_CUSTOM_DIRECTIVES];

    for (const typeName of Object.keys(typeMap)) {
      const type = typeMap[typeName];

      if (typeName.startsWith('__')) continue; // skip introspection types
      if (!isObjectType(type) && !isInterfaceType(type)) continue;

      const fields = type.getFields();

      for (const fieldName of Object.keys(fields)) {
        const field: GraphQLField<any, any> = fields[fieldName];
        const directives = field.astNode?.directives ?? [];

        for (const directive of directives) {
          if (!allKnown.includes(directive.name.value)) {
            result.errors.push(
              `Unknown directive @${directive.name.value} on ${typeName}.${fieldName}`,
            );
          }
        }
      }
    }
  }
}
