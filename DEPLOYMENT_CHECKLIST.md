# Deployment Checklist

Quick checklist for deploying Sanhoti to AWS EC2.

## Pre-Deployment

- [ ] AWS account created
- [ ] EC2 instance created (t2.micro, Ubuntu 22.04)
- [ ] Security group configured (ports 22, 80, 443)
- [ ] Key pair downloaded and secured
- [ ] Domain name configured (optional)
- [ ] Repository pushed to Git (git@github.com:debasisnice/Sanhoti.git)

## Server Setup

- [ ] Connected to EC2 via SSH
- [ ] System updated (`sudo apt update && sudo apt upgrade`)
- [ ] Node.js 18.x installed
- [ ] Nginx installed and running
- [ ] PM2 installed globally
- [ ] Application directory created (`/var/www/sanhoti`)

## Application Deployment

- [ ] Code deployed to server (Git clone or SCP)
- [ ] Backend dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend `.env` file created with production values
- [ ] Frontend `.env` file created (if needed)
- [ ] Required directories created (`data`, `uploads`, etc.)
- [ ] Backend built (`npm run build`)
- [ ] Frontend built (`npm run build`)

## Configuration

- [ ] Nginx configuration file created
- [ ] Nginx site enabled
- [ ] Nginx configuration tested (`sudo nginx -t`)
- [ ] CORS origins updated for production domain
- [ ] SSL certificate installed (if using domain)
- [ ] PM2 startup script configured

## Start Services

- [ ] Backend started with PM2 (`pm2 start`)
- [ ] PM2 process list saved (`pm2 save`)
- [ ] Backend health check passing (`curl http://localhost:5001/health`)
- [ ] Nginx reloaded/restarted
- [ ] All services running (`pm2 status`, `sudo systemctl status nginx`)

## Verification

- [ ] Website accessible via IP address or domain
- [ ] Frontend loads correctly
- [ ] API endpoints responding
- [ ] Authentication working
- [ ] File uploads working
- [ ] Images loading correctly
- [ ] SSL certificate working (if configured)

## Post-Deployment

- [ ] Backup script created and tested
- [ ] Crontab configured for backups
- [ ] Monitoring setup (PM2 monit)
- [ ] Documentation updated with production URLs
- [ ] Team notified of deployment
- [ ] First admin user created

## Security

- [ ] Strong JWT_SECRET set
- [ ] `.env` file not in Git
- [ ] SSH key secured (chmod 400)
- [ ] Firewall configured (UFW)
- [ ] Security headers added to Nginx
- [ ] SSL certificate auto-renewal working

## Maintenance Setup

- [ ] Update procedure documented
- [ ] Backup location confirmed
- [ ] Log rotation configured
- [ ] Monitoring alerts set up (optional)

---

## Quick Commands Reference

```bash
# Check all services
pm2 status
sudo systemctl status nginx

# View logs
pm2 logs sanhoti-backend
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart sanhoti-backend
sudo systemctl restart nginx

# Update application
cd /var/www/sanhoti
git pull
cd backend && npm install && npm run build && pm2 restart sanhoti-backend
cd ../frontend && npm install && npm run build
sudo systemctl reload nginx
```

