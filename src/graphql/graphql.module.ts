import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PubSub } from 'graphql-subscriptions';
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

@Module({
  imports: [
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema/schema.graphql'),
      sortSchema: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      context: ({ req, connection }, _, { injector }) => {
        if (connection) {
          return { req: connection.context };
        }
        // Attach DataLoaders to context for N+1 prevention
        const dataLoaderService = injector?.get(DataLoaderService);
        const loaders = dataLoaderService?.createLoaders() || {};
        return { req, loaders };
      },
      formatError: (error) => {
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        };
      },
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
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [DataLoaderService, 'PUB_SUB'],
})
export class GraphQLModule {}
