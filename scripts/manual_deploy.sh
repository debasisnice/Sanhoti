#!/bin/bash

# Manual Deployment Script for Sanhoti to AWS EC2
# Usage: ./manual_deploy.sh

set -e  # Exit on error

echo "🚀 Sanhoti Manual Deployment Script"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
EC2_HOST="44.220.179.207"
EC2_USER="ubuntu"
EC2_KEY="${HOME}/Downloads/sanhoti-keypair.pem"
APP_DIR="/var/www/sanhoti"

# Check if SSH key exists
if [ ! -f "$EC2_KEY" ]; then
    echo -e "${RED}❌ SSH key not found at: $EC2_KEY${NC}"
    echo "Please update EC2_KEY in this script or place your key at: $EC2_KEY"
    exit 1
fi

echo -e "${YELLOW}Step 1: Building backend locally...${NC}"
cd backend
npm install
npm run build
echo -e "${GREEN}✓ Backend built${NC}"

echo ""
echo -e "${YELLOW}Step 2: Building frontend locally...${NC}"
cd ../frontend
npm install
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

echo ""
echo -e "${YELLOW}Step 3: Committing and pushing to Git...${NC}"
cd ..
git add -A
git commit -m "Manual deployment $(date +%Y-%m-%d_%H-%M-%S)" || echo "No changes to commit"
git push
echo -e "${GREEN}✓ Code pushed to Git${NC}"

echo ""
echo -e "${YELLOW}Step 4: Connecting to EC2 and deploying...${NC}"

# SSH into EC2 and run deployment commands
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" << 'ENDSSH'
set -e

APP_DIR="/var/www/sanhoti"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "📍 Current directory: $(pwd)"
echo ""

# Navigate to app directory
echo "📂 Navigating to $APP_DIR..."
cd "$APP_DIR" || { echo "❌ Directory $APP_DIR not found!"; exit 1; }

# Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin main || git pull origin master || { echo "⚠️  Git pull failed, continuing..."; }

# Build backend
echo "🔨 Building backend..."
cd "$BACKEND_DIR"
npm ci --production=false
npm run build

# Build frontend
echo "🎨 Building frontend..."
cd "$FRONTEND_DIR"
npm ci --production=false
npm run build

# Restart backend with PM2
echo "🔄 Restarting backend..."
if pm2 list | grep -q "sanhoti-backend"; then
    pm2 restart sanhoti-backend
    echo "✅ Backend restarted"
else
    cd "$BACKEND_DIR"
    pm2 start dist/server.js --name sanhoti-backend
    pm2 save
    echo "✅ Backend started"
fi

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx || echo "⚠️  Nginx reload failed (non-critical)"

# Check status
echo ""
echo "📊 Deployment Status:"
echo "===================="
pm2 status
echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your application should be available at:"
echo "   http://$EC2_HOST"
echo "   http://$EC2_HOST/health"
ENDSSH

echo ""
echo -e "${GREEN}✅ Manual deployment completed!${NC}"
echo ""
echo "🌐 Your application should be available at:"
echo "   http://${EC2_HOST}"
echo "   http://${EC2_HOST}/health"
echo ""
echo "📝 To check logs on EC2:"
echo "   ssh -i ${EC2_KEY} ${EC2_USER}@${EC2_HOST}"
echo "   pm2 logs sanhoti-backend"
echo ""


