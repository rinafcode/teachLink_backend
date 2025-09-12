import { ServiceMeshService } from './service-mesh.service';

describe('ServiceMeshService', () => {
  let service: ServiceMeshService;

  beforeEach(() => {
    service = new ServiceMeshService();
  });

  it('should send a message to another service', async () => {
    const result = await service.sendMessage('svc', { foo: 'bar' });
    expect(result).toEqual({
      status: 'sent',
      serviceName: 'svc',
      payload: { foo: 'bar' },
    });
  });

  it('should route a request to the appropriate service', async () => {
    const result = await service.routeRequest('/api/test', { data: 123 });
    expect(result).toEqual({
      status: 'routed',
      path: '/api/test',
      payload: { data: 123 },
    });
  });
});
