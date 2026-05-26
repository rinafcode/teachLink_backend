import { check, sleep } from 'k6';
import http from 'k6/http';
import { chaosRequest } from '../utils/chaos-client';

export const options = {
  vus: 15,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.2'], // tolerate some failure
  },
};

export default function () {
  const res: any = chaosRequest('http://localhost:3000/auth/login');

  check(res, {
    'handles failures gracefully': (r) =>
      r.status === 200 ||
      r.status === 400 ||
      r.status === 401 ||
      r.status === 0,
  });

  sleep(1);
}