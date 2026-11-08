import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const rateLimitThrottledRate = new Rate('rate_limit_throttled_rate');
const allowedLatency = new Trend('allowed_req_duration_ms');
const rejectedLatency = new Trend('rejected_req_duration_ms');

export const options = {
  scenarios: {
    // Scenario 1: Normal steady state traffic (10 VUs for 30s)
    steady_state_traffic: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'testNormalTraffic',
    },
    // Scenario 2: Sudden burst traffic spike (ramp from 10 to 60 VUs in 10s)
    burst_traffic_spike: {
      executor: 'ramping-vus',
      startTime: '30s',
      stages: [
        { duration: '5s', target: 20 },
        { duration: '10s', target: 80 }, // sudden burst spike exceeding token bucket limit
        { duration: '15s', target: 10 },
      ],
      exec: 'testTrafficSpike',
    },
    // Scenario 3: High concurrency payment checkout (Sliding Window test)
    strict_checkout_concurrency: {
      executor: 'constant-vus',
      vus: 25,
      duration: '20s',
      startTime: '60s',
      exec: 'testCheckoutLimit',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<150'], // 95% of evaluations under 150ms
    rate_limit_throttled_rate: ['rate>0.05'], // Verify limiter actually engaged
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'rg_live_ecom9941a27488bc110f01c89012345678ab';

export function testNormalTraffic() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  const res = http.get(`${BASE_URL}/api/demo/products`, params);

  const isThrottled = res.status === 429;
  rateLimitThrottledRate.add(isThrottled);

  if (isThrottled) {
    rejectedLatency.add(res.timings.duration);
    check(res, {
      'has Retry-After header': (r) => r.headers['Retry-After'] !== undefined,
      'has 429 status code': (r) => r.status === 429,
    });
  } else {
    allowedLatency.add(res.timings.duration);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'has X-RateLimit-Limit': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
      'has X-RateLimit-Remaining': (r) => r.headers['X-Ratelimit-Remaining'] !== undefined,
    });
  }

  sleep(0.1);
}

export function testTrafficSpike() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  const res = http.get(`${BASE_URL}/api/demo/orders`, params);
  const isThrottled = res.status === 429;
  rateLimitThrottledRate.add(isThrottled);

  check(res, {
    'valid response status (200 or 429)': (r) => r.status === 200 || r.status === 429,
    'has RateLimit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  sleep(0.05);
}

export function testCheckoutLimit() {
  const payload = JSON.stringify({
    cartItems: ['item_901', 'item_902'],
    paymentMethod: 'credit_card',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'rg_live_paym77218391823901823901283019283019',
    },
  };

  const res = http.post(`${BASE_URL}/api/demo/checkout`, payload, params);
  const isThrottled = res.status === 429;
  rateLimitThrottledRate.add(isThrottled);

  if (isThrottled) {
    check(res, {
      'rejected with 429': (r) => r.status === 429,
      'has Retry-After': (r) => r.headers['Retry-After'] !== undefined,
    });
  } else {
    check(res, {
      'checkout accepted (201)': (r) => r.status === 201,
    });
  }

  sleep(0.08);
}
