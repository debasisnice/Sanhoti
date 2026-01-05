#!/bin/bash

# Fix Homepage Image Upload Issue on AWS
# This script ensures the directory exists and restarts the backend

set -e

echo "🔧 Fixing Homepage Image Upload Issue..."
echo ""

# 1. Navigate to project directory
cd /var/www/sanhoti

# 2. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main
echo "✅ Code updated"
echo ""

# 3. Create HomePage_Images directory if it doesn't exist
echo "📁 Creating HomePage_Images directory..."
mkdir -p backend/data/HomePage_Images
chmod 755 backend/data/HomePage_Images
echo "✅ Directory created/verified"
ls -la backend/data/ | grep HomePage
echo ""

# 4. Rebuild backend
echo "🔨 Rebuilding backend..."
cd backend
npm ci
npm run build
echo "✅ Backend rebuilt"
echo ""

# 5. Verify HomePageController exists
echo "🔍 Verifying HomePageController..."
if [ -f "dist/controllers/HomePageController.js" ]; then
    echo "✅ HomePageController found"
else
    echo "❌ HomePageController NOT found!"
    exit 1
fi
echo ""

# 6. Restart backend
echo "🔄 Restarting backend..."
cd ..
pm2 restart sanhoti-backend
sleep 3
echo "✅ Backend restarted"
echo ""

# 7. Check backend logs
echo "📋 Recent backend logs:"
pm2 logs sanhoti-backend --lines 20 --nostream
echo ""

# 8. Test the endpoint
echo "🧪 Testing homepage images endpoint:"
curl -s http://localhost:5001/api/homepage/images | head -20
echo ""
echo ""

# 9. Check PM2 status
echo "📊 PM2 Status:"
pm2 list
echo ""

echo "✅ Fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Try uploading images again from admin settings"
echo "   2. Check backend logs if still failing: pm2 logs sanhoti-backend --lines 50"
echo "   3. Verify directory exists: ls -la /var/www/sanhoti/backend/data/HomePage_Images"

