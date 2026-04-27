import { Injectable, Logger } from '@nestjs/common';
import { GraphQLSchema, FieldNode, OperationDefinitionNode, visit, parse } from 'graphql';
import { GRAPHQL_CONSTANTS } from './query-complexity.constants';

/**
 * Query complexity analysis configuration
 */
export interface IComplexityConfig {
  /** Maximum query depth allowed (default: 10) */
  maxDepth: number;
  /** Maximum complexity score allowed (default: 1000) */
  maxComplexity: number;
  /** Complexity scalar multipliers for list fields */
  listScalarMultiplier: number;
  /** Default complexity per field */
  defaultFieldComplexity: number;
  /** Custom complexity values for specific types/fields */
  fieldComplexityMap: Record<string, number>;
}

/**
 * Complexity analysis result
 */
export interface IComplexityResult {
  /** Total complexity score */
  complexity: number;
  /** Query depth */
  depth: number;
  /** Whether the query exceeds limits */
  allowed: boolean;
  /** Error message if not allowed */
  error?: string;
}

/**
 * Query Complexity Analysis Service
 *
 * Provides:
 * - Query depth limiting
 * - Field complexity calculation
 * - Query cost analysis
 */
@Injectable()
export class QueryComplexityService {
  private readonly logger = new Logger(QueryComplexityService.name);

  private readonly defaultConfig: IComplexityConfig = {
    maxDepth: GRAPHQL_CONSTANTS.MAX_DEPTH,
    maxComplexity: GRAPHQL_CONSTANTS.MAX_COMPLEXITY,
    listScalarMultiplier: GRAPHQL_CONSTANTS.LIST_SCALAR_MULTIPLIER,
    defaultFieldComplexity: 1,
    fieldComplexityMap: GRAPHQL_CONSTANTS.FIELD_COMPLEXITY_MAP,
  };

  private config: IComplexityConfig;
  private schema: GraphQLSchema | null = null;

  constructor() {
    // Initialize with environment-based configuration
    this.config = {
      ...this.defaultConfig,
      maxDepth: parseInt(process.env.GRAPHQL_MAX_DEPTH || `${GRAPHQL_CONSTANTS.MAX_DEPTH}`, 10),
      maxComplexity: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY || `${GRAPHQL_CONSTANTS.MAX_COMPLEXITY}`, 10),
      listScalarMultiplier: parseInt(process.env.GRAPHQL_LIST_MULTIPLIER || `${GRAPHQL_CONSTANTS.LIST_SCALAR_MULTIPLIER}`, 10),
    };
  }

  /**
   * Set the GraphQL schema for complexity analysis
   */
  setSchema(schema: GraphQLSchema): void {
    this.schema = schema;
  }

  /**
   * Update complexity configuration
   */
  setConfig(config: Partial<IComplexityConfig>): void {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Analyze a query for complexity
   */
  analyze(query: string, variables?: Record<string, any>): IComplexityResult {
    try {
      // Parse the query to get AST
      const ast = parse(query);

      // Find the operation
      const operation = this.findOperation(ast);
      if (!operation) {
        return {
          complexity: 0,
          depth: 0,
          allowed: true,
        };
      }

      // Calculate depth and complexity
      const depth = this.calculateDepth(operation);
      const complexity = this.calculateComplexity(operation, variables);

      // Check if within limits
      const allowed = depth <= this.config.maxDepth && complexity <= this.config.maxComplexity;

      let error: string | undefined;
      if (!allowed) {
        if (depth > this.config.maxDepth) {
          error = `Query depth ${depth} exceeds maximum allowed depth ${this.config.maxDepth}`;
        } else {
          error = `Query complexity ${complexity} exceeds maximum allowed complexity ${this.config.maxComplexity}`;
        }
        this.logger.warn(`Query rejected: ${error}`);
      }

      return {
        complexity,
        depth,
        allowed,
        error,
      };
    } catch (error) {
      this.logger.error(`Error analyzing query complexity: ${error.message}`);
      // On parse error, allow the query to proceed (it will fail at execution anyway)
      return {
        complexity: 0,
        depth: 0,
        allowed: true,
        error: undefined,
      };
    }
  }

  /**
   * Calculate the depth of a query
   */
  private calculateDepth(operation: OperationDefinitionNode): number {
    let maxDepth = 0;

    const visitor = {
      Field: {
        enter: (node: FieldNode) => {
          const depth = this.getFieldDepth(node);
          if (depth > maxDepth) {
            maxDepth = depth;
          }
        },
      },
    };

    visit(operation, visitor);
    return maxDepth;
  }

  /**
   * Get the depth of a specific field
   */
  private getFieldDepth(field: FieldNode, currentDepth: number = 0): number {
    if (!field.selectionSet) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const selection of field.selectionSet.selections) {
      if (selection.kind === 'Field') {
        const depth = this.getFieldDepth(selection, currentDepth + 1);
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }
    }

    return maxDepth;
  }

  /**
   * Calculate the complexity score of a query
   */
  private calculateComplexity(
    operation: OperationDefinitionNode,
    variables?: Record<string, any>,
  ): number {
    let totalComplexity = 0;

    const visitor = {
      Field: {
        enter: (node: FieldNode): void => {
          const fieldName = node.name.value;
          const args = node.arguments || [];

          // Get complexity for this field
          let fieldComplexity =
            this.config.fieldComplexityMap[fieldName] || this.config.defaultFieldComplexity;

          // Check for list arguments (like limit, first, last)
          for (const arg of args) {
            if (
              arg.name.value === 'limit' ||
              arg.name.value === 'first' ||
              arg.name.value === 'last'
            ) {
              // Get the actual value from variables or literal
              let listSize = 10; // Default
              if (arg.value.kind === 'IntValue') {
                listSize = parseInt(arg.value.value, 10);
              } else if (arg.value.kind === 'Variable' && variables) {
                listSize = variables[arg.value.name.value] || 10;
              }
              // Multiply complexity by list size with scalar
              fieldComplexity += (listSize - 1) * this.config.listScalarMultiplier;
            }
          }

          totalComplexity += fieldComplexity;

          // Stop if we exceeds max complexity (early termination)
          if (totalComplexity > this.config.maxComplexity) {
            // Early termination by throwing an error
            throw new Error(
              `Query complexity ${totalComplexity} exceeds maximum allowed complexity of ${this.config.maxComplexity}`,
            );
          }
        },
      },
    };

    visit(operation, visitor);
    return totalComplexity;
  }

  /**
   * Find the main operation in the query
   */
  private findOperation(ast: any): OperationDefinitionNode | null {
    const definitions = ast.definitions || [];

    for (const def of definitions) {
      if (def.kind === 'OperationDefinition') {
        // Return first query operation
        if (def.operation === 'query') {
          return def;
        }
      }
    }

    return null;
  }

  /**
   * Get current configuration
   */
  getConfig(): IComplexityConfig {
    return { ...this.config };
  }

  /**
   * Validate a query against complexity limits
   * Returns true if query is allowed, false otherwise
   */
  validate(query: string, variables?: Record<string, any>): boolean {
    const result = this.analyze(query, variables);
    return result.allowed;
  }
}

/**
 * GraphQL complexity validator function for Apollo Server
 */
export function createComplexityValidator(service: QueryComplexityService) {
  return (query: string, variables?: Record<string, any>): Error | undefined => {
    const result = service.analyze(query, variables);
    if (!result.allowed && result.error) {
      return new Error(result.error);
    }
    return undefined;
  };
}
