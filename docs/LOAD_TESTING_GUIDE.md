# Load Testing Guide for Sanhoti Website

## Overview
This guide provides instructions for load testing the public-facing pages of the Sanhoti website at `http://44.220.179.207/`.

## Public Pages to Test

### Frontend Routes (Public)
- `/` - Home page
- `/sponsors` - Sponsors carousel
- `/donate` - Donate page
- `/contact` - Contact page
- `/committee` - Committee members
- `/events` - Events listing with carousel
- `/events/:id` - Event detail page
- `/notices` - Notices listing
- `/galleries` - Public galleries
- `/galleries/:id` - Gallery detail
- `/magazines` - Magazines listing
- `/documents` - Documents listing

### Public API Endpoints
- `GET /api/events` - Active events
- `GET /api/events/upcoming` - Upcoming events
- `GET /api/events/past` - Past events
- `GET /api/events/:id` - Event by ID
- `GET /api/notices/public` - Published notices
- `GET /api/galleries/public` - Public galleries
- `GET /api/magazines/public` - Public magazines
- `GET /api/documents/public` - Public documents
- `GET /api/committee` - Committee members
- `GET /api/settings` - Public settings
- `GET /api/sponsors/images` - Sponsor images
- `GET /api/homepage/images` - Homepage images
- `GET /api/boardmembers/images` - Board member images
- `GET /api/sub-events/event/:eventId` - Sub-events for an event

## Recommended Tools

### 1. k6 (Recommended)
- **Pros**: Modern, JavaScript-based, excellent performance, good reporting
- **Installation**: 
  ```bash
  # macOS
  brew install k6
  
  # Linux
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update
  sudo apt-get install k6
  ```

### 2. Apache JMeter
- **Pros**: GUI-based, comprehensive features, widely used
- **Installation**: Download from https://jmeter.apache.org/

### 3. Artillery
- **Pros**: Node.js-based, easy YAML configuration
- **Installation**: `npm install -g artillery`

## Load Testing Scenarios

### Scenario 1: Home Page Traffic (Most Common)
- **Target**: `/`
- **Expected Load**: 50-100 concurrent users
- **Duration**: 5-10 minutes
- **Focus**: Homepage slideshow, priority event, sections

### Scenario 2: Events Page Navigation
- **Target**: `/events` → `/events/:id` (navigate to event details)
- **Expected Load**: 30-50 concurrent users
- **Duration**: 5 minutes
- **Focus**: Event carousel, event detail page, sub-events

### Scenario 3: Gallery Browsing
- **Target**: `/galleries` → `/galleries/:id`
- **Expected Load**: 20-40 concurrent users
- **Duration**: 5 minutes
- **Focus**: Gallery listing, image loading

### Scenario 4: Mixed Navigation (Realistic User Journey)
- **Target**: Multiple pages in sequence
- **Flow**: Home → Events → Event Detail → Notices → Sponsors → Donate
- **Expected Load**: 25-50 concurrent users
- **Duration**: 10 minutes

### Scenario 5: Peak Traffic Simulation
- **Target**: All public pages
- **Expected Load**: 100-200 concurrent users
- **Duration**: 15 minutes
- **Focus**: System stability under high load

## k6 Load Test Script Example

Create a file `load-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = 'http://44.220.179.207';

// Custom metric for error rate
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.01'],     // Error rate should be less than 1%
    errors: ['rate<0.01'],
  },
};

// Test data - you may need to fetch actual event IDs from the API first
let eventIds = [];
let galleryIds = [];

export function setup() {
  // Fetch real IDs from API for dynamic testing
  const eventsRes = http.get(`${BASE_URL}/api/events`);
  if (eventsRes.status === 200) {
    const events = JSON.parse(eventsRes.body);
    eventIds = events.map(e => e.event_id || e.id).slice(0, 5);
  }
  
  const galleriesRes = http.get(`${BASE_URL}/api/galleries/public`);
  if (galleriesRes.status === 200) {
    const galleries = JSON.parse(galleriesRes.body);
    galleryIds = galleries.map(g => g.id).slice(0, 3);
  }
  
  return { eventIds, galleryIds };
}

export default function(data) {
  const pages = [
    { url: '/', name: 'Home' },
    { url: '/sponsors', name: 'Sponsors' },
    { url: '/donate', name: 'Donate' },
    { url: '/contact', name: 'Contact' },
    { url: '/committee', name: 'Committee' },
    { url: '/events', name: 'Events' },
    { url: '/notices', name: 'Notices' },
    { url: '/galleries', name: 'Galleries' },
    { url: '/magazines', name: 'Magazines' },
    { url: '/documents', name: 'Documents' },
  ];

  // Random page navigation
  const page = pages[Math.floor(Math.random() * pages.length)];
  
  let res = http.get(`${BASE_URL}${page.url}`, {
    tags: { name: page.name },
  });
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!success);
  
  // If on events page, navigate to event detail
  if (page.url === '/events' && data.eventIds.length > 0) {
    sleep(1);
    const eventId = data.eventIds[Math.floor(Math.random() * data.eventIds.length)];
    res = http.get(`${BASE_URL}/events/${eventId}`, {
      tags: { name: 'EventDetail' },
    });
    check(res, {
      'event detail status is 200': (r) => r.status === 200,
    });
  }
  
  // If on galleries page, navigate to gallery detail
  if (page.url === '/galleries' && data.galleryIds.length > 0) {
    sleep(1);
    const galleryId = data.galleryIds[Math.floor(Math.random() * data.galleryIds.length)];
    res = http.get(`${BASE_URL}/galleries/${galleryId}`, {
      tags: { name: 'GalleryDetail' },
    });
    check(res, {
      'gallery detail status is 200': (r) => r.status === 200,
    });
  }
  
  sleep(Math.random() * 3 + 1); // Random think time 1-4 seconds
}
```

## Running k6 Tests

```bash
# Run the load test
k6 run load-test.js

# Run with custom options
k6 run --vus 50 --duration 5m load-test.js

# Generate HTML report
k6 run --out json=results.json load-test.js
k6 report results.json
```

## Artillery Configuration Example

Create `artillery-config.yml`:

```yaml
config:
  target: 'http://44.220.179.207'
  phases:
    - duration: 120
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 120
      arrivalRate: 100
      name: "Peak load"
    - duration: 60
      arrivalRate: 0
      name: "Cool down"
  processor: "./artillery-processor.js"

scenarios:
  - name: "Public Pages Navigation"
    flow:
      - get:
          url: "/"
          name: "Home"
      - think: 2
      - get:
          url: "/events"
          name: "Events"
      - think: 1
      - get:
          url: "/sponsors"
          name: "Sponsors"
      - think: 1
      - get:
          url: "/notices"
          name: "Notices"
      - think: 1
      - get:
          url: "/galleries"
          name: "Galleries"
```

## What to Monitor

### Server Metrics (on AWS EC2)
```bash
# CPU usage
top
htop

# Memory usage
free -h

# Network I/O
iftop
nethogs

# Disk I/O
iostat -x 1

# Nginx status
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PM2 monitoring
pm2 monit
pm2 logs sanhoti-backend
```

### Application Metrics
- Response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Throughput (requests per second)
- Concurrent connections
- API endpoint performance

### Key Thresholds
- **Response Time**: < 2 seconds for 95% of requests
- **Error Rate**: < 1%
- **CPU Usage**: < 80%
- **Memory Usage**: < 80%
- **Nginx**: Check for 502/503 errors

## Best Practices

1. **Start Small**: Begin with 10-20 concurrent users, gradually increase
2. **Monitor Resources**: Watch CPU, memory, and network during tests
3. **Test Realistic Scenarios**: Simulate actual user behavior (think time, navigation patterns)
4. **Test During Off-Peak**: Initially test during low-traffic periods
5. **Document Results**: Keep records of test results for comparison
6. **Test Incrementally**: Don't jump to 1000 users immediately

## Expected Results

Based on your current AWS setup:
- **EC2 Instance**: t2.micro or similar
- **Expected Capacity**: 50-100 concurrent users comfortably
- **Bottlenecks**: Likely CPU or memory on small instance

## Troubleshooting

### High Error Rates
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check PM2 logs: `pm2 logs sanhoti-backend`
- Check system resources: `htop`, `free -h`

### Slow Response Times
- Check database/JSON file access (if reading large files)
- Check image loading (sponsors, galleries)
- Check Nginx configuration for caching

### Server Crashes
- Check memory limits
- Check PM2 max memory restart
- Consider upgrading EC2 instance

## Sample k6 Quick Test

Quick 1-minute test with 10 users:

```bash
k6 run --vus 10 --duration 1m - <<EOF
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  const res = http.get('http://44.220.179.207/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
}
EOF
```

## Next Steps

1. Install k6 or Artillery
2. Create test script based on your needs
3. Run initial small-scale test (10-20 users)
4. Monitor server resources
5. Gradually increase load
6. Document findings and optimize as needed

