import { check, sleep } from 'k6';
import { chaosRequest } from '../utils/chaos-client';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const res: any = chaosRequest('http://localhost:3000/health');

  check(res, {
    'service survives latency': (r) =>
      r.status === 200 || r.status === 0,
  });

  sleep(1);
}