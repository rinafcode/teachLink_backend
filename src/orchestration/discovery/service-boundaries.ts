import { RequestMethod } from '@nestjs/common';

export type ServiceCommunicationMode = 'sync' | 'async' | 'hybrid';

export interface IServiceBoundaryDefinition {
  serviceName: string;
  domain: string;
  description: string;
  routePrefixes: string[];
  dependencies: string[];
  communicationMode: ServiceCommunicationMode;
  supportedMethods?: RequestMethod[];
}

export const SERVICE_BOUNDARIES: Record<string, IServiceBoundaryDefinition> = {
  auth: {
    serviceName: 'auth',
    domain: 'identity',
    description: 'Authentication, authorization, and session workflows.',
    routePrefixes: ['/auth', '/session'],
    dependencies: ['users', 'notifications'],
    communicationMode: 'sync',
  },
  users: {
    serviceName: 'users',
    domain: 'identity',
    description: 'User accounts, profiles, and learner membership state.',
    routePrefixes: ['/users'],
    dependencies: ['auth', 'notifications'],
    communicationMode: 'sync',
  },
  courses: {
    serviceName: 'courses',
    domain: 'learning',
    description: 'Course, lesson, and enrollment operations.',
    routePrefixes: ['/courses', '/learning-paths'],
    dependencies: ['users', 'assessment', 'collaboration'],
    communicationMode: 'hybrid',
  },
  assessment: {
    serviceName: 'assessment',
    domain: 'learning',
    description: 'Assessments, scoring, and feedback processing.',
    routePrefixes: ['/assessment'],
    dependencies: ['courses', 'users'],
    communicationMode: 'hybrid',
  },
  collaboration: {
    serviceName: 'collaboration',
    domain: 'engagement',
    description: 'Real-time collaboration, whiteboard, and sharing features.',
    routePrefixes: ['/collaboration'],
    dependencies: ['auth', 'users', 'notifications'],
    communicationMode: 'hybrid',
  },
  notifications: {
    serviceName: 'notifications',
    domain: 'engagement',
    description: 'Email and in-product notification delivery.',
    routePrefixes: ['/notifications'],
    dependencies: ['users'],
    communicationMode: 'async',
  },
  payments: {
    serviceName: 'payments',
    domain: 'commerce',
    description: 'Billing, subscriptions, and webhook ingestion.',
    routePrefixes: ['/payments'],
    dependencies: ['users', 'notifications'],
    communicationMode: 'sync',
  },
  media: {
    serviceName: 'media',
    domain: 'content',
    description: 'Asset upload, processing, and delivery orchestration.',
    routePrefixes: ['/media', '/cdn'],
    dependencies: ['auth', 'users'],
    communicationMode: 'hybrid',
  },
  search: {
    serviceName: 'search',
    domain: 'content',
    description: 'Search indexing, querying, and autocomplete.',
    routePrefixes: ['/search'],
    dependencies: ['courses', 'media'],
    communicationMode: 'async',
  },
};

export function normalizeServiceRoute(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.replace(/\/{2,}/g, '/');
}

export function findBoundaryByRoute(
  path: string,
  method?: RequestMethod,
): IServiceBoundaryDefinition | undefined {
  const normalizedPath = normalizeServiceRoute(path);

  return Object.values(SERVICE_BOUNDARIES).find((boundary) => {
    const methodMatches =
      !method || !boundary.supportedMethods || boundary.supportedMethods.includes(method);

    return (
      methodMatches &&
      boundary.routePrefixes.some((prefix) =>
        normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
      )
    );
  });
}
