import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphQLError, validate } from 'graphql';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';
import { AssessmentsModule } from '../assessment/assessment.module';
import { AuthModule } from '../auth/auth.module';
import { QueryResolver } from './resolvers/query.resolver';
import { MutationResolver } from './resolvers/mutation.resolver';
import { SubscriptionResolver } from './resolvers/subscription.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { CourseResolver } from './resolvers/course.resolver';
import { AssessmentResolver } from './resolvers/assessment.resolver';
import { DataLoaderService } from './services/dataloader.service';
import { QueryComplexityService } from './services/query-complexity.service';
import { SchemaLintService } from './services/schema-lint.service';
import { DirectiveValidationService } from './services/directive-validation.service';
import { ComplexityAnalysisService } from './services/complexity-analysis.service';
import {
  applySubscriptionConnectionHeaders,
  createGraphQLContext,
} from './subscriptions/subscription-context';
import { pubSubProvider } from './subscriptions/pub-sub.provider';

@Module({
  imports: [
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (complexityService: ComplexityAnalysisService) =>
        ({
          autoSchemaFile: join(process.cwd(), 'src/graphql/schema/schema.graphql'),
          sortSchema: true,
          playground: process.env.NODE_ENV !== 'production',
          subscriptions: {
            'graphql-ws': {
              onConnect: async (context) => {
                const request = (context.extra as { request?: { headers?: Record<string, unknown> } })
                  ?.request;
                applySubscriptionConnectionHeaders(request, context.connectionParams);
              },
            },
          },

          // ── Schema Validation: complexity + depth rules per request ──
          validationRules: [
            // depth-limit rule applied globally
            (context) => {
              const maxDepth = complexityService.config.maxDepth;
              return {
                OperationDefinition(node) {
                  const depth = getDepth(node);
                  if (depth > maxDepth) {
                    context.reportError(
                      new GraphQLError(
                        `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}`,
                      ),
                    );
                  }
                },
              };
            },
          ],

          plugins: [
            // ── Per-request complexity analysis plugin ──
            {
              requestDidStart: async () => ({
                didResolveOperation({ request, document, schema }) {
                  const variables = request.variables ?? {};
                  const rule = complexityService.buildComplexityRule(schema, document, variables);
                  const errors = validate(schema, document, [rule]);
                  if (errors.length > 0) {
                    throw errors[0];
                  }
                },
              }),
            },
          ] as any,

          context: (context, _, { injector }) => createGraphQLContext(context, injector),

          formatError: (error) => ({
            message: error.message,
            code: error.extensions?.code,
            path: error.path,
          }),
        }) as Omit<ApolloDriverConfig, 'driver'>,
      inject: [ComplexityAnalysisService],
    }),
    UsersModule,
    CoursesModule,
    AssessmentsModule,
    AuthModule,
  ],
  providers: [
    QueryResolver,
    MutationResolver,
    SubscriptionResolver,
    UserResolver,
    CourseResolver,
    AssessmentResolver,
    DataLoaderService,
    QueryComplexityService,
    SchemaLintService,
    DirectiveValidationService,
    ComplexityAnalysisService,
    pubSubProvider,
  ],
  exports: [
    DataLoaderService,
    QueryComplexityService,
    SchemaLintService,
    DirectiveValidationService,
    ComplexityAnalysisService,
    pubSubProvider.provide,
  ],
})
export class GraphQLModule {}

// ── Helper: calculate selection depth from AST node ──
function getDepth(node: any, depth = 0): number {
  if (!node?.selectionSet?.selections) return depth;
  return Math.max(...node.selectionSet.selections.map((s: any) => getDepth(s, depth + 1)));
}
