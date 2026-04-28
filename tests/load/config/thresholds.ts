export const thresholds = {
  http_req_duration: ['p(95)<800'], // 95% requests under 800ms
  http_req_failed: ['rate<0.05'],   // <5% errors
};