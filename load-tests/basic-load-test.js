import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.02'],   // Error rate should be less than 2%
    errors: ['rate<0.02'],
  },
}

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Mock user data
const users = [
  { email: 'user1@test.com', password: 'password123' },
  { email: 'user2@test.com', password: 'password123' },
  { email: 'user3@test.com', password: 'password123' },
]

export function setup() {
  // Setup phase - create test users if needed
  console.log('Setting up load test...')

  // Health check
  const healthResponse = http.get(`${BASE_URL}/api/health`)
  check(healthResponse, {
    'health check successful': (r) => r.status === 200,
  })

  return { baseUrl: BASE_URL }
}

export default function(data) {
  const user = users[Math.floor(Math.random() * users.length)]

  // Test 1: Load homepage
  const homeResponse = http.get(data.baseUrl)
  const homeSuccess = check(homeResponse, {
    'homepage loads successfully': (r) => r.status === 200,
    'homepage contains title': (r) => r.body.includes('kAInban'),
    'homepage response time < 2s': (r) => r.timings.duration < 2000,
  })
  errorRate.add(!homeSuccess)

  sleep(1)

  // Test 2: API health check
  const healthResponse = http.get(`${data.baseUrl}/api/health`)
  const healthSuccess = check(healthResponse, {
    'health endpoint responds': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  })
  errorRate.add(!healthSuccess)

  sleep(1)

  // Test 3: Authentication flow
  const loginData = {
    email: user.email,
    password: user.password,
  }

  const loginResponse = http.post(
    `${data.baseUrl}/api/auth/login`,
    JSON.stringify(loginData),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  const loginSuccess = check(loginResponse, {
    'login attempt completes': (r) => r.status === 200 || r.status === 401,
    'login response time < 1s': (r) => r.timings.duration < 1000,
  })
  errorRate.add(!loginSuccess)

  // If login successful, test authenticated endpoints
  if (loginResponse.status === 200) {
    sleep(1)

    // Test 4: Get projects
    const projectsResponse = http.get(`${data.baseUrl}/api/projects`)
    const projectsSuccess = check(projectsResponse, {
      'projects endpoint responds': (r) => r.status === 200 || r.status === 401,
      'projects response time < 1s': (r) => r.timings.duration < 1000,
    })
    errorRate.add(!projectsSuccess)

    sleep(1)

    // Test 5: Create a project
    const projectData = {
      name: `Load Test Project ${Math.random().toString(36).substr(2, 9)}`,
    }

    const createProjectResponse = http.post(
      `${data.baseUrl}/api/projects`,
      JSON.stringify(projectData),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    const createProjectSuccess = check(createProjectResponse, {
      'create project completes': (r) => r.status === 201 || r.status === 401,
      'create project response time < 1s': (r) => r.timings.duration < 1000,
    })
    errorRate.add(!createProjectSuccess)
  }

  sleep(2)
}

export function teardown(data) {
  console.log('Tearing down load test...')
  // Cleanup phase if needed
}