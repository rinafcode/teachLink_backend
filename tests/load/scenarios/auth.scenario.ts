import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
};

export default function () {
  const payload = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  const res = http.post(
    'http://localhost:3000/auth/login',
    payload,
    { headers }
  );

  check(res, {
    'login success or handled': (r) => r.status === 200 || r.status === 401,
    'response time < 800ms': (r) => r.timings.duration < 800,
  });

  sleep(1);
}