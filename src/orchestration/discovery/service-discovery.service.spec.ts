import { ServiceDiscoveryService } from './service-discovery.service';

describe('ServiceDiscoveryService', () => {
  let service: ServiceDiscoveryService;

  beforeEach(() => {
    service = new ServiceDiscoveryService();
  });

  it('discovers a service from its owned route boundary', async () => {
    service.register({
      id: 'courses-1',
      name: 'courses',
      baseUrl: 'http://courses.internal',
      healthy: true,
    });

    await expect(service.discoverByRoute('/courses/42/lessons')).resolves.toMatchObject({
      id: 'courses-1',
      name: 'courses',
      baseUrl: 'http://courses.internal',
      boundary: expect.objectContaining({
        domain: 'learning',
        communicationMode: 'hybrid',
      }),
    });
  });

  it('falls back to a co-located service instance when no remote instance is registered', async () => {
    await expect(service.getService('notifications')).resolves.toMatchObject({
      id: 'notifications-local',
      baseUrl: 'http://localhost:3000',
      boundary: expect.objectContaining({
        serviceName: 'notifications',
        communicationMode: 'async',
      }),
    });
  });
});
