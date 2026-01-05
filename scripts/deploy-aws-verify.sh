#!/bin/bash

# AWS Deployment Verification Script
# Run this on the AWS server after deployment

set -e

echo "🔍 Verifying AWS Deployment..."
echo "================================"
echo ""

APP_DIR="/var/www/sanhoti"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Checking Git Status...${NC}"
cd "$APP_DIR"
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git ls-remote origin main | cut -f1)
echo "Current commit: $CURRENT_COMMIT"
echo "Latest commit:  $LATEST_COMMIT"
if [ "$CURRENT_COMMIT" != "$LATEST_COMMIT" ]; then
    echo -e "${RED}⚠️  Server is not on latest commit!${NC}"
    echo "Run: git pull origin main"
else
    echo -e "${GREEN}✓ Server is on latest commit${NC}"
fi
echo ""

echo -e "${YELLOW}Step 2: Checking Backend Build...${NC}"
if [ -d "$BACKEND_DIR/dist" ]; then
    echo -e "${GREEN}✓ Backend dist folder exists${NC}"
else
    echo -e "${RED}✗ Backend dist folder missing${NC}"
    echo "Run: cd $BACKEND_DIR && npm run build"
fi
echo ""

echo -e "${YELLOW}Step 3: Checking Frontend Build...${NC}"
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${GREEN}✓ Frontend dist folder exists${NC}"
    echo "Build date: $(stat -c %y $FRONTEND_DIR/dist 2>/dev/null || stat -f %Sm $FRONTEND_DIR/dist 2>/dev/null || echo 'unknown')"
else
    echo -e "${RED}✗ Frontend dist folder missing${NC}"
    echo "Run: cd $FRONTEND_DIR && npm ci && npm run build"
fi
echo ""

echo -e "${YELLOW}Step 4: Checking PM2 Process...${NC}"
if pm2 list | grep -q "sanhoti-backend"; then
    echo -e "${GREEN}✓ Backend process is running${NC}"
    pm2 list | grep "sanhoti-backend"
else
    echo -e "${RED}✗ Backend process not found${NC}"
    echo "Run: pm2 start $BACKEND_DIR/dist/server.js --name sanhoti-backend"
fi
echo ""

echo -e "${YELLOW}Step 5: Checking Backend Health...${NC}"
if curl -s http://localhost:5001/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
    curl -s http://localhost:5001/health | head -1
else
    echo -e "${RED}✗ Backend is not responding${NC}"
fi
echo ""

echo -e "${YELLOW}Step 6: Checking Nginx...${NC}"
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
    echo "Run: sudo systemctl start nginx"
fi
echo ""

echo -e "${YELLOW}Step 7: Checking settings.json...${NC}"
if [ -f "$BACKEND_DIR/data/settings.json" ]; then
    echo -e "${GREEN}✓ settings.json exists${NC}"
    echo "Note: This file is not in git (for security). It will be auto-created with defaults if missing."
else
    echo -e "${YELLOW}⚠️  settings.json doesn't exist (will be auto-created on first use)${NC}"
fi
echo ""

echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "If any issues were found, follow the suggested commands above."

