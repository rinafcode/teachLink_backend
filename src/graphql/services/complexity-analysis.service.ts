import { Injectable, Logger } from '@nestjs/common';
import { GraphQLSchema, DocumentNode, validate } from 'graphql';
import {
  createComplexityRule,
  simpleEstimator,
  fieldExtensionsEstimator,
  ComplexityEstimator,
} from 'graphql-query-complexity';

export interface ComplexityConfig {
  maxComplexity: number;
  maxDepth: number;
  defaultCost: number;
}

export interface ComplexityAnalysisResult {
  allowed: boolean;
  complexity: number;
  depth: number;
  errors: string[];
}

@Injectable()
export class ComplexityAnalysisService {
  private readonly logger = new Logger(ComplexityAnalysisService.name);

  readonly config: ComplexityConfig = {
    maxComplexity: Number(process.env.GRAPHQL_MAX_COMPLEXITY) || 100,
    maxDepth: Number(process.env.GRAPHQL_MAX_DEPTH) || 10,
    defaultCost: 1,
  };

  buildComplexityRule(
    schema: GraphQLSchema,
    document: DocumentNode,
    variables: Record<string, any>,
  ) {
    const estimators: ComplexityEstimator[] = [
      fieldExtensionsEstimator(),
      simpleEstimator({ defaultComplexity: this.config.defaultCost }),
    ];

    return createComplexityRule({
      maximumComplexity: this.config.maxComplexity,
      variables,
      estimators,
      onComplete: (complexity: number) => {
        this.logger.log(
          `Query complexity: ${complexity} / ${this.config.maxComplexity}`,
        );
        if (complexity > this.config.maxComplexity * 0.8) {
          this.logger.warn(
            `High complexity query detected: ${complexity} (threshold: ${this.config.maxComplexity})`,
          );
        }
      },
      createError: (max: number, actual: number) => {
        const msg = `Query too complex: score ${actual} exceeds maximum of ${max}`;
        this.logger.error(msg);
        return new Error(msg);
      },
    });
  }

  analyzeQuery(
    schema: GraphQLSchema,
    document: DocumentNode,
    variables: Record<string, any> = {},
  ): ComplexityAnalysisResult {
    const result: ComplexityAnalysisResult = {
      allowed: true,
      complexity: 0,
      depth: 0,
      errors: [],
    };

    // Depth check
    result.depth = this.calculateDepth(document);
    if (result.depth > this.config.maxDepth) {
      result.allowed = false;
      result.errors.push(
        `Query depth ${result.depth} exceeds max allowed depth of ${this.config.maxDepth}`,
      );
    }

    // Complexity check via validate
    const validationErrors = validate(schema, document, [
      this.buildComplexityRule(schema, document, variables),
    ]);

    if (validationErrors.length > 0) {
      result.allowed = false;
      result.errors.push(...validationErrors.map((e) => e.message));
    }

    return result;
  }

  private calculateDepth(document: DocumentNode): number {
    let maxDepth = 0;

    const traverse = (node: any, depth: number) => {
      if (!node) return;
      if (depth > maxDepth) maxDepth = depth;

      const selections =
        node.selectionSet?.selections ||
        node.definitions?.flatMap((d: any) => d.selectionSet?.selections ?? []) ||
        [];

      for (const selection of selections) {
        traverse(selection, depth + 1);
      }
    };

    traverse(document, 0);
    return maxDepth;
  }
}