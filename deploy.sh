#!/bin/bash

# Sanhoti Deployment Script for AWS EC2
# This script helps automate the deployment process

set -e  # Exit on error

echo "🚀 Sanhoti Deployment Script"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on server
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please don't run this script as root${NC}"
   exit 1
fi

APP_DIR="/var/www/sanhoti"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Pull latest changes from Git (if repository is set up)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Pulling latest changes from Git...${NC}"
    git pull origin main || git pull origin master || echo "Could not pull from Git, continuing with build..."
fi

echo -e "${YELLOW}Step 1: Building Backend...${NC}"
cd "$BACKEND_DIR"
npm install
npm run build
echo -e "${GREEN}✓ Backend built successfully${NC}"

echo ""
echo -e "${YELLOW}Step 2: Building Frontend...${NC}"
cd "$FRONTEND_DIR"
npm install
npm run build
echo -e "${GREEN}✓ Frontend built successfully${NC}"

echo ""
echo -e "${YELLOW}Step 3: Restarting Services...${NC}"

# Restart backend with PM2
if pm2 list | grep -q "sanhoti-backend"; then
    pm2 restart sanhoti-backend
    echo -e "${GREEN}✓ Backend restarted${NC}"
else
    pm2 start "$BACKEND_DIR/dist/server.js" --name sanhoti-backend
    pm2 save
    echo -e "${GREEN}✓ Backend started${NC}"
fi

# Reload Nginx
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx reloaded${NC}"

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Check your application:"
echo "  - Backend: http://localhost:5001/health"
echo "  - Frontend: Check your domain or IP"
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs sanhoti-backend"
echo "  - Monitor: pm2 monit"
echo "  - Status: pm2 status"

