import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = 'http://44.220.179.207';

// Custom metric for error rate
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 20 },   // Stay at 20 users
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.01'],     // Error rate should be less than 1%
    errors: ['rate<0.01'],
  },
};

// Test data - fetch actual IDs from API
let eventIds = [];
let galleryIds = [];

export function setup() {
  console.log('Setting up test data...');
  
  // Fetch real event IDs
  try {
    const eventsRes = http.get(`${BASE_URL}/api/events`);
    if (eventsRes.status === 200) {
      const events = JSON.parse(eventsRes.body);
      eventIds = events.map(e => e.event_id || e.id).filter(Boolean).slice(0, 5);
      console.log(`Found ${eventIds.length} events`);
    }
  } catch (e) {
    console.log('Could not fetch events:', e);
  }
  
  // Fetch real gallery IDs
  try {
    const galleriesRes = http.get(`${BASE_URL}/api/galleries/public`);
    if (galleriesRes.status === 200) {
      const galleries = JSON.parse(galleriesRes.body);
      galleryIds = galleries.map(g => g.id).filter(Boolean).slice(0, 3);
      console.log(`Found ${galleryIds.length} galleries`);
    }
  } catch (e) {
    console.log('Could not fetch galleries:', e);
  }
  
  return { eventIds, galleryIds };
}

export default function(data) {
  // Public pages to test
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

  // Random page navigation (simulating real user behavior)
  const page = pages[Math.floor(Math.random() * pages.length)];
  
  let res = http.get(`${BASE_URL}${page.url}`, {
    tags: { name: page.name },
  });
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
    'has content': (r) => r.body.length > 0,
  });
  
  errorRate.add(!success);
  
  // Simulate user clicking into event detail
  if (page.url === '/events' && data.eventIds.length > 0 && Math.random() > 0.5) {
    sleep(1 + Math.random() * 2); // Think time 1-3 seconds
    const eventId = data.eventIds[Math.floor(Math.random() * data.eventIds.length)];
    res = http.get(`${BASE_URL}/events/${eventId}`, {
      tags: { name: 'EventDetail' },
    });
    check(res, {
      'event detail status is 200': (r) => r.status === 200,
      'event detail response time < 3s': (r) => r.timings.duration < 3000,
    });
  }
  
  // Simulate user clicking into gallery detail
  if (page.url === '/galleries' && data.galleryIds.length > 0 && Math.random() > 0.5) {
    sleep(1 + Math.random() * 2); // Think time 1-3 seconds
    const galleryId = data.galleryIds[Math.floor(Math.random() * data.galleryIds.length)];
    res = http.get(`${BASE_URL}/galleries/${galleryId}`, {
      tags: { name: 'GalleryDetail' },
    });
    check(res, {
      'gallery detail status is 200': (r) => r.status === 200,
      'gallery detail response time < 3s': (r) => r.timings.duration < 3000,
    });
  }
  
  // Random think time between requests (simulating reading time)
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

