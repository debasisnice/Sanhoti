#!/bin/bash

# Fix PM2 Duplicate Processes - Run on AWS server
# This script cleans up duplicate backend processes

set -e

echo "🔧 Fixing PM2 duplicate processes..."
echo ""

# Stop all duplicate backend processes
echo "🛑 Stopping duplicate backend processes..."
pm2 stop backend 2>/dev/null || true
pm2 delete backend 2>/dev/null || true

# Restart the correct backend process (sanhoti-backend)
echo "🔄 Restarting sanhoti-backend..."
pm2 restart sanhoti-backend

# Show status
echo ""
echo "📊 Current PM2 status:"
pm2 list

# Save PM2 configuration
pm2 save

echo ""
echo "✅ Done! Backend should be running correctly now."
echo ""
echo "🧪 Test backend:"
echo "   curl http://localhost:5001/health"

