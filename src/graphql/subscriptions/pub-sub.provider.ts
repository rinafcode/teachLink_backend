import { PubSub } from 'graphql-subscriptions';

export const PUB_SUB = 'PUB_SUB';

export const pubSubProvider = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};
