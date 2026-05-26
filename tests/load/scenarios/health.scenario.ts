import http from 'k6/http';
import { check, sleep } from 'k6';
import { thresholds } from '../config/thresholds';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds,
};

export default function () {
  const res = http.get('http://localhost:3000/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}