import { ServiceMeshService } from './service-mesh.service';
import { of } from 'rxjs';
describe('ServiceMeshService', () => {
  it('propagates correlation ID to external API call headers', async () => {
    const serviceDiscovery: any = {
      resolveService: jest.fn().mockResolvedValue({
        id: 'dummy-1',
        name: 'dummy',
        baseUrl: 'http://localhost',
        boundary: { domain: 'platform' },
      }),
      markUnhealthy: jest.fn(),
    };
    const httpService: any = {
      request: jest.fn().mockReturnValue(of({ data: { ok: true } })),
    };

    const service = new ServiceMeshService(serviceDiscovery, httpService);

    await expect(service.request('dummy', '/ping', 'GET')).resolves.toEqual({ ok: true });

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-request-id': expect.any(String) }),
      }),
    );
  });

  it('routes requests by service boundary and annotates service metadata headers', async () => {
    const serviceDiscovery: any = {
      discoverByRoute: jest.fn().mockResolvedValue({
        id: 'courses-1',
        name: 'courses',
        baseUrl: 'http://courses.internal',
        boundary: { domain: 'learning' },
      }),
      markUnhealthy: jest.fn(),
    };
    const httpService: any = {
      request: jest.fn().mockReturnValue(of({ data: { routed: true } })),
    };

    const service = new ServiceMeshService(serviceDiscovery, httpService);

    await expect(service.requestByRoute('/courses/12', 'GET')).resolves.toEqual({ routed: true });

    expect(serviceDiscovery.discoverByRoute).toHaveBeenCalledWith('/courses/12');
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://courses.internal/courses/12',
        headers: expect.objectContaining({
          'x-service-name': 'courses',
          'x-service-domain': 'learning',
        }),
      }),
    );
  });
});
