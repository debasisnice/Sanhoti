# Fix Magazine PDF on AWS Deployment

## Issue
PDF is viewable locally but not on deployed AWS version (http://44.220.179.207/magazines)

## Root Causes & Solutions

### 1. Frontend Not Rebuilt on AWS

**Problem:** Latest PDF fixes haven't been deployed to AWS.

**Solution:** Rebuild frontend on AWS server:

```bash
# SSH into AWS server
ssh -i your-key.pem ubuntu@44.220.179.207

# Navigate to project
cd /var/www/sanhoti

# Pull latest code
git pull origin main

# Rebuild frontend
cd frontend
npm ci
npm run build

# Verify PDF worker file exists in dist
ls -lah dist/pdfjs/pdf.worker.min.mjs

# Reload Nginx
cd ..
sudo systemctl reload nginx
```

### 2. PDF Worker File Not Accessible

**Problem:** PDF.js worker file not being served correctly.

**Check if worker file exists:**
```bash
# On AWS server
ls -lah /var/www/sanhoti/frontend/dist/pdfjs/pdf.worker.min.mjs
ls -lah /var/www/sanhoti/frontend/public/pdfjs/pdf.worker.min.mjs
```

**Test if worker is accessible:**
```bash
# From browser or curl
curl -I http://44.220.179.207/pdfjs/pdf.worker.min.mjs
# Should return: HTTP/1.1 200 OK
```

**If 404, check Nginx is serving public files:**
- The `dist/pdfjs/` should be copied from `public/pdfjs/` during build
- Verify Vite copies public files correctly

### 3. PDF File Not on AWS Server

**Problem:** The PDF file doesn't exist on AWS server.

**Check if PDF file exists:**
```bash
# On AWS server
ls -lah /var/www/sanhoti/backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf
```

**If missing, pull from Git:**
```bash
cd /var/www/sanhoti
git pull origin main
ls -lah backend/data/Magazines/
```

### 4. Backend Route Not Working

**Problem:** Backend not serving PDF files correctly.

**Test backend route:**
```bash
# On AWS server
curl -I http://localhost:5001/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf
# Should return: HTTP/1.1 200 OK, Content-Type: application/pdf

# Test from external URL
curl -I http://44.220.179.207/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf
```

**Check backend logs:**
```bash
pm2 logs backend --lines 50
```

### 5. CORS or Network Issues

**Problem:** Browser blocking PDF requests.

**Check browser console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Click on magazine to open PDF
4. Look for errors:
   - CORS errors
   - 404 errors
   - Network errors
   - PDF.js worker errors

**Check Network tab:**
1. Go to Network tab
2. Filter by "pdf" or "magazines"
3. Click on magazine
4. Check request URL and status code

## Complete Fix Checklist

Run these commands on your AWS server:

```bash
# 1. SSH into server
ssh -i your-key.pem ubuntu@44.220.179.207

# 2. Navigate to project
cd /var/www/sanhoti

# 3. Pull latest code
git pull origin main

# 4. Verify PDF file exists
ls -lah backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf
# Should show file size ~65MB

# 5. Verify PDF worker exists in public
ls -lah frontend/public/pdfjs/pdf.worker.min.mjs

# 6. Rebuild frontend
cd frontend
npm ci
npm run build

# 7. Verify PDF worker in dist
ls -lah dist/pdfjs/pdf.worker.min.mjs
# Should exist

# 8. Test backend route
curl -I http://localhost:5001/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf

# 9. Reload Nginx
cd ..
sudo systemctl reload nginx

# 10. Restart backend (if needed)
pm2 restart backend

# 11. Test PDF worker accessibility
curl -I http://localhost/pdfjs/pdf.worker.min.mjs
```

## Browser Debugging Steps

1. **Open browser DevTools (F12)**
2. **Go to Console tab**
3. **Click on magazine to open PDF modal**
4. **Look for errors:**
   - `Failed to load PDF file`
   - `PDF.js worker failed to load`
   - `404 Not Found` errors
   - CORS errors

5. **Go to Network tab**
6. **Filter by "pdf" or "magazines"**
7. **Check requests:**
   - PDF file request: `/api/magazines/files/...`
   - Worker request: `/pdfjs/pdf.worker.min.mjs`
   - Status codes should be 200

## Common Errors & Solutions

### Error: "Failed to load PDF file"

**Possible causes:**
1. PDF file doesn't exist on server
2. Backend route not working
3. URL construction issue

**Fix:**
```bash
# Check file exists
ls -lah backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf

# Test backend route
curl http://localhost:5001/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf -o test.pdf
# Should download PDF file

# Check backend logs
pm2 logs backend --lines 50
```

### Error: "PDF.js worker failed to load"

**Possible causes:**
1. Worker file not in dist
2. Worker file not accessible via Nginx
3. Wrong worker path

**Fix:**
```bash
# Verify worker file exists
ls -lah frontend/dist/pdfjs/pdf.worker.min.mjs

# Test accessibility
curl -I http://localhost/pdfjs/pdf.worker.min.mjs

# If 404, check Nginx is serving static files correctly
```

### Error: 404 for PDF file

**Possible causes:**
1. File doesn't exist
2. Backend route issue
3. Nginx proxy issue

**Fix:**
```bash
# Check file exists
ls -lah backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf

# Test backend directly
curl -I http://localhost:5001/api/magazines/files/1767569863524-Uttoron_2025_Sanhoti.pdf

# Check Nginx proxy
sudo nginx -t
sudo systemctl status nginx
```

## Verification Steps

After applying fixes:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Visit:** http://44.220.179.207/magazines
3. **Click on magazine** to open PDF
4. **Check browser console** for errors
5. **Verify PDF loads** and displays correctly

## Quick Fix Script

The script is available at `../scripts/fix-pdf-aws.sh`. Run on AWS server:

```bash
#!/bin/bash
set -e

echo "🔧 Fixing PDF on AWS..."

cd /var/www/sanhoti

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Verify PDF file
echo "📄 Checking PDF file..."
if [ ! -f "backend/data/Magazines/1767569863524-Uttoron_2025_Sanhoti.pdf" ]; then
    echo "❌ PDF file not found!"
    exit 1
fi
echo "✅ PDF file exists"

# Rebuild frontend
echo "🔨 Rebuilding frontend..."
cd frontend
npm ci
npm run build

# Verify worker file
if [ ! -f "dist/pdfjs/pdf.worker.min.mjs" ]; then
    echo "❌ PDF worker file not in dist!"
    exit 1
fi
echo "✅ PDF worker file exists in dist"

# Reload Nginx
echo "🔄 Reloading Nginx..."
cd ..
sudo systemctl reload nginx

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart backend

echo "✅ Done! Test at http://44.220.179.207/magazines"
```

