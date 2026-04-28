import { DataLoaderService } from '../services/dataloader.service';

type RequestLike = {
  headers?: Record<string, unknown>;
  user?: unknown;
};

type GraphQLContextArgs = {
  req?: RequestLike;
  extra?: { request?: RequestLike };
  connectionParams?: Record<string, unknown>;
};

type InjectorLike = {
  get?: <T>(type: unknown) => T;
};

function getHeaderValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

function getAuthorizationHeader(connectionParams?: Record<string, unknown>): string | undefined {
  if (!connectionParams) {
    return undefined;
  }

  const authHeader =
    getHeaderValue(connectionParams.Authorization) ||
    getHeaderValue(connectionParams.authorization);

  if (authHeader) {
    return authHeader;
  }

  const token =
    getHeaderValue(connectionParams.authToken) || getHeaderValue(connectionParams.token);

  return token ? `Bearer ${token}` : undefined;
}

export function applySubscriptionConnectionHeaders(
  request: RequestLike | undefined,
  connectionParams?: Record<string, unknown>,
): void {
  if (!request) {
    return;
  }

  const authorization = getAuthorizationHeader(connectionParams);
  const cookie =
    getHeaderValue(connectionParams?.Cookie) || getHeaderValue(connectionParams?.cookie);

  request.headers = {
    ...(request.headers || {}),
    ...(authorization ? { authorization } : {}),
    ...(cookie ? { cookie } : {}),
  };
}

export function createGraphQLContext(
  contextArgs: GraphQLContextArgs,
  injector?: InjectorLike,
): Record<string, unknown> {
  const request = contextArgs.req || contextArgs.extra?.request || { headers: {} };

  applySubscriptionConnectionHeaders(request, contextArgs.connectionParams);

  const dataLoaderService = injector?.get?.(DataLoaderService) as DataLoaderService | undefined;
  const loaders = dataLoaderService?.createLoaders() || {};

  return {
    req: request,
    loaders,
    connectionParams: contextArgs.connectionParams,
  };
}
