import { ServiceMeshService } from './service-mesh.service';
import { of } from 'rxjs';

describe('ServiceMeshService', () => {
  it('propagates correlation ID to external API call headers', async () => {
    const serviceDiscovery: any = {
      getService: jest.fn().mockResolvedValue({ baseUrl: 'http://localhost' }),
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
});
