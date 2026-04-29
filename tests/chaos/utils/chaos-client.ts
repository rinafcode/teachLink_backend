import http from 'k6/http';

export function chaosRequest(url: string, options: any = {}) {
  const faultType = Math.random();

  // 20% latency injection
  if (faultType < 0.2) {
    sleepRandom(500, 1500);
  }

  // 10% request drop (simulate network failure)
  if (faultType >= 0.2 && faultType < 0.3) {
    return { status: 0, error: 'Simulated network failure' };
  }

  // 10% error injection (bad payload)
  if (faultType >= 0.3 && faultType < 0.4) {
    options.body = JSON.stringify({ invalid: true });
  }

  return http.get(url, options);
}

function sleepRandom(min: number, max: number) {
  const delay = Math.random() * (max - min) + min;
  const start = Date.now();
  while (Date.now() - start < delay) {
    // busy wait (k6 compatible)
  }
}