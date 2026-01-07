#!/bin/bash

# Quick load test script using k6
# Tests basic homepage load with 10 concurrent users for 1 minute

echo "Starting quick load test..."
echo "Target: http://44.220.179.207/"
echo "Users: 10"
echo "Duration: 1 minute"
echo ""

k6 run --vus 10 --duration 1m - <<'EOF'
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  const res = http.get('http://44.220.179.207/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has content': (r) => r.body.length > 0,
  });
}
EOF

echo ""
echo "Load test completed!"

