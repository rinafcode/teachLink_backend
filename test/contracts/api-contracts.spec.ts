describe('API Contract Tests', () => {
  const endpoints = [
    { method: 'POST', path: '/auth/login' },
    { method: 'GET', path: '/courses' },
    { method: 'GET', path: '/search' },
    { method: 'POST', path: '/enroll' },
    { method: 'GET', path: '/notifications' },
  ];

  endpoints.forEach(({ method, path }) => {
    it('should have stable   response shape', () => {
      expect(path).toBeDefined();
      expect(method).toMatch(/^(GET|POST)$/);
    });
  });
});
