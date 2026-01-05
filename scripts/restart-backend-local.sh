#!/bin/bash

# Restart Backend Locally
# This script kills any existing backend process and provides instructions to restart

echo "🔄 Restarting Backend Locally..."
echo ""

# Kill any process on port 5001
echo "🛑 Stopping any existing backend process..."
lsof -ti:5001 | xargs kill -9 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️  No backend process found on port 5001"
echo ""

# Rebuild backend
echo "🔨 Rebuilding backend..."
cd backend
npm run build
echo "✅ Backend rebuilt"
echo ""

# Check if dist files exist
if [ -f "dist/controllers/HomePageController.js" ]; then
    echo "✅ HomePageController found in dist"
else
    echo "❌ HomePageController NOT found in dist!"
    echo "   Please check the build output above"
fi
echo ""

echo "📋 Next steps:"
echo "   1. Start the backend in a terminal:"
echo "      cd backend"
echo "      npm run dev"
echo ""
echo "   2. Or if using the root dev script:"
echo "      npm run dev:backend"
echo ""
echo "   3. Wait for 'Server running on port 5001' message"
echo "   4. Then try uploading images again from admin settings"

