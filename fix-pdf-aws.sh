#!/bin/bash

# Fix PDF on AWS - Run this script on your AWS EC2 server
# Usage: sudo bash fix-pdf-aws.sh

set -e  # Exit on error

echo "🔧 Fixing PDF on AWS Deployment..."
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo: sudo bash fix-pdf-aws.sh"
    exit 1
fi

# Navigate to project directory
cd /var/www/sanhoti

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code from Git..."
git pull origin main
echo "✅ Code updated"
echo ""

# Step 2: Verify PDF file exists
echo "📄 Step 2: Checking PDF file..."
if [ ! -f "backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf" ]; then
    echo "❌ PDF file not found!"
    echo "   Expected: backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf"
    exit 1
fi
PDF_SIZE=$(ls -lh backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf | awk '{print $5}')
echo "✅ PDF file exists (Size: $PDF_SIZE)"
echo ""

# Step 3: Verify PDF worker file exists in public
echo "🔧 Step 3: Checking PDF worker file in public directory..."
if [ ! -f "frontend/public/pdfjs/pdf.worker.min.mjs" ]; then
    echo "❌ PDF worker file not found in public directory!"
    exit 1
fi
echo "✅ PDF worker file exists in public"
echo ""

# Step 4: Rebuild frontend
echo "🔨 Step 4: Rebuilding frontend..."
cd frontend
npm ci
npm run build
echo "✅ Frontend rebuilt"
echo ""

# Step 5: Verify PDF worker in dist
echo "🔍 Step 5: Verifying PDF worker in dist..."
if [ ! -f "dist/pdfjs/pdf.worker.min.mjs" ]; then
    echo "❌ PDF worker file not found in dist directory!"
    echo "   This means Vite didn't copy it from public/"
    exit 1
fi
echo "✅ PDF worker file exists in dist"
echo ""

# Step 6: Test backend route
echo "🌐 Step 6: Testing backend route..."
cd ..
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf)
if [ "$BACKEND_TEST" != "200" ]; then
    echo "⚠️  Warning: Backend route returned HTTP $BACKEND_TEST"
    echo "   This might indicate an issue with the backend route"
else
    echo "✅ Backend route is working (HTTP 200)"
fi
echo ""

# Step 7: Test PDF worker accessibility
echo "🔍 Step 7: Testing PDF worker accessibility..."
WORKER_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/pdfjs/pdf.worker.min.mjs)
if [ "$WORKER_TEST" != "200" ]; then
    echo "⚠️  Warning: PDF worker returned HTTP $WORKER_TEST"
    echo "   Check Nginx configuration"
else
    echo "✅ PDF worker is accessible (HTTP 200)"
fi
echo ""

# Step 8: Reload Nginx
echo "🔄 Step 8: Reloading Nginx..."
systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# Step 9: Restart backend
echo "🔄 Step 9: Restarting backend..."
pm2 restart backend
echo "✅ Backend restarted"
echo ""

echo "✅ All steps completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Clear browser cache (Ctrl+Shift+Delete)"
echo "   2. Visit: http://44.220.179.207/magazines"
echo "   3. Click on magazine to open PDF"
echo "   4. Check browser console (F12) for any errors"
echo ""
echo "🔍 If PDF still doesn't work:"
echo "   - Check browser console for errors"
echo "   - Check Network tab for failed requests"
echo "   - Verify PDF file: curl -I http://44.220.179.207/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf"
echo "   - Verify worker: curl -I http://44.220.179.207/pdfjs/pdf.worker.min.mjs"

