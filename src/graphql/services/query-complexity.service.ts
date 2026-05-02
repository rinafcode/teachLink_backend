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
      maxComplexity: parseInt(
        process.env.GRAPHQL_MAX_COMPLEXITY || `${GRAPHQL_CONSTANTS.MAX_COMPLEXITY}`,
        10,
      ),
      listScalarMultiplier: parseInt(
        process.env.GRAPHQL_LIST_MULTIPLIER || `${GRAPHQL_CONSTANTS.LIST_SCALAR_MULTIPLIER}`,
        10,
      ),
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
    /**
     * Set the GraphQL schema for complexity analysis
     */
    setSchema(schema: GraphQLSchema): void {
        this.schema = schema;
    }
    /**
     * Update complexity configuration
     */
    setConfig(config: Partial<ComplexityConfig>): void {
        this.config = { ...this.defaultConfig, ...config };
    }
    /**
     * Analyze a query for complexity
     */
    analyze(query: string, variables?: Record<string, unknown>): ComplexityResult {
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
                }
                else {
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
        }
        catch (error) {
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
    return (query: string, variables?: Record<string, unknown>): Error | undefined => {
        const result = service.analyze(query, variables);
        if (!result.allowed && result.error) {
            return new Error(result.error);
        }
        return undefined;
    };
}
