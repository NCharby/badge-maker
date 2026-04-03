# Badge Maker - Production Deployment Guide

## Overview
This guide covers deploying the Badge Maker application to a Hostinger VPS running Ubuntu. The application is a Next.js 14 app with Supabase backend, requiring Node.js, PostgreSQL, and various external services.

## Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ (recommended: Ubuntu 22.04 LTS)
- **RAM**: Minimum 2GB (recommended: 4GB+)
- **Storage**: Minimum 20GB SSD
- **CPU**: 2+ cores recommended
- **Network**: Public IP with ports 80, 443, and 22 open

### External Services Required
- **Supabase Project**: Database and file storage
- **Postmark Account**: Email service for notifications
- **Telegram Bot** (optional): For private group invites
- **Domain Name**: For SSL certificate and production URL

## Step 1: Server Setup

### 1.1 Initial Server Configuration
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Create application user
sudo adduser --system --group --home /opt/badge-maker badge-maker
sudo usermod -aG sudo badge-maker
```

### 1.2 Install Node.js (v18+)
```bash
# Install Node.js via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v18.x.x or higher
npm --version
```

### 1.3 Install PM2 (Process Manager)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
sudo pm2 startup
# Follow the instructions provided by the command
```

### 1.4 Install Nginx (Reverse Proxy)
```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 1.5 Install Certbot (SSL Certificates)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Test certificate generation (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --dry-run
```

## Step 2: Application Deployment

### 2.1 Clone Repository
```bash
# Switch to application user
sudo su - badge-maker

# Clone the repository
cd /opt/badge-maker
git clone https://github.com/yourusername/badge-maker.git .

# Install dependencies
npm ci --production
```

### 2.2 Environment Configuration
```bash
# Create production environment file
cp env.example .env.local

# Edit environment variables
nano .env.local
```

**Required Environment Variables:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=Badge Maker

# File Upload Configuration
NEXT_PUBLIC_MAX_FILE_SIZE=5242880
NEXT_PUBLIC_ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp

# Storage Configuration
NEXT_PUBLIC_STORAGE_BUCKET_BADGE_IMAGES=badge-images
NEXT_PUBLIC_STORAGE_BUCKET_WAIVER_DOCUMENTS=waiver-documents

# Waiver Configuration
WAIVER_VERSION=1.0.0
PDF_ACCESS_EXPIRY_HOURS=24

# Email Service (Postmark)
POSTMARK_API_KEY=your_postmark_api_key
POSTMARK_FROM_EMAIL=noreply@yourdomain.com
POSTMARK_TEMPLATE_ID=your_template_id

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_INVITE_EXPIRY_HOURS=24

# Production Settings
NODE_ENV=production
NEXT_PUBLIC_DEBUG=false
```

### 2.3 Build Application
```bash
# Build the application
npm run build

# Verify build
ls -la .next/
```

### 2.4 Create PM2 Configuration
```bash
# Create PM2 ecosystem file
nano ecosystem.config.js
```

**PM2 Configuration (`ecosystem.config.js`):**
```javascript
module.exports = {
  apps: [{
    name: 'badge-maker',
    script: 'npm',
    args: 'start',
    cwd: '/opt/badge-maker',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/badge-maker/error.log',
    out_file: '/var/log/badge-maker/out.log',
    log_file: '/var/log/badge-maker/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 2.5 Setup Logging Directory
```bash
# Create log directory
sudo mkdir -p /var/log/badge-maker
sudo chown badge-maker:badge-maker /var/log/badge-maker
```

## Step 3: Nginx Configuration

### 3.1 Create Nginx Site Configuration
```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/badge-maker
```

**Nginx Configuration (`/etc/nginx/sites-available/badge-maker`):**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (will be managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Upload rate limiting
    location /api/upload {
        limit_req zone=upload burst=5 nodelay;
        client_max_body_size 10M;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # Static files caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 3.2 Enable Site and Test Configuration
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/badge-maker /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 4: SSL Certificate Setup

### 4.1 Obtain SSL Certificate
```bash
# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 4.2 Setup Automatic Renewal
```bash
# Add to crontab
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 5: Database Setup

### 5.1 Supabase Configuration
1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Run Database Schema**: Execute the `supabase/schema.sql` file in your Supabase SQL editor
3. **Configure Storage**: Ensure storage buckets are created and policies are set
4. **Get API Keys**: Copy the project URL and API keys to your `.env.local`

### 5.2 Verify Database Connection
```bash
# Test database connection (optional)
curl -X GET "https://yourdomain.com/api/test-db"
```

## Step 6: External Services Setup

### 6.1 Postmark Email Service
1. **Create Postmark Account**: Sign up at [postmarkapp.com](https://postmarkapp.com)
2. **Create Server**: Create a new server in Postmark
3. **Create Template**: Create an email template for badge confirmations
4. **Get API Key**: Copy the server API key to your `.env.local`
5. **Verify Sender**: Verify your sender email address

### 6.2 Telegram Bot (Optional)
1. **Create Bot**: Message [@BotFather](https://t.me/botfather) on Telegram
2. **Get Token**: Save the bot token to your `.env.local`
3. **Add to Group**: Add the bot to your private group as an administrator
4. **Set Permissions**: Grant "Invite Users via Link" and "Manage Chat" permissions

## Step 7: Start Application

### 7.1 Start with PM2
```bash
# Switch to application user
sudo su - badge-maker

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs badge-maker
```

### 7.2 Verify Deployment
```bash
# Check if application is running
curl -I https://yourdomain.com

# Check health endpoint
curl https://yourdomain.com/health

# Check application logs
pm2 logs badge-maker --lines 50
```

## Step 8: Monitoring and Maintenance

### 8.1 Setup Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/badge-maker
```

**Logrotate Configuration:**
```
/var/log/badge-maker/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 badge-maker badge-maker
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 8.2 Setup Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Monitor system resources
htop
```

### 8.3 Backup Strategy
```bash
# Create backup script
sudo nano /opt/backup-badge-maker.sh
```

**Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/badge-maker"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /opt badge-maker --exclude=node_modules --exclude=.next

# Keep only last 7 days of backups
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/app_$DATE.tar.gz"
```

```bash
# Make executable and add to crontab
sudo chmod +x /opt/backup-badge-maker.sh
sudo crontab -e

# Add daily backup at 2 AM:
0 2 * * * /opt/backup-badge-maker.sh
```

## Step 9: Security Hardening

### 9.1 Firewall Configuration
```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

### 9.2 SSH Security
```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config

# Recommended settings:
# Port 22 (or change to custom port)
# PermitRootLogin no
# PasswordAuthentication no (if using SSH keys)
# PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart ssh
```

### 9.3 Fail2Ban (Optional)
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

## Step 10: Deployment Commands

### 10.1 Update Application
```bash
# Switch to application user
sudo su - badge-maker

# Navigate to app directory
cd /opt/badge-maker

# Pull latest changes
git pull origin main

# Install/update dependencies
npm ci --production

# Build application
npm run build

# Restart application
pm2 restart badge-maker

# Check status
pm2 status
```

### 10.2 Common PM2 Commands
```bash
# View logs
pm2 logs badge-maker

# Restart application
pm2 restart badge-maker

# Stop application
pm2 stop badge-maker

# Delete application from PM2
pm2 delete badge-maker

# Monitor resources
pm2 monit
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs badge-maker
   
   # Check environment variables
   cat .env.local
   
   # Test build locally
   npm run build
   ```

2. **Nginx 502 Bad Gateway**
   ```bash
   # Check if app is running
   pm2 status
   
   # Check Nginx error logs
   sudo tail -f /var/log/nginx/error.log
   
   # Test application directly
   curl http://localhost:3000
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   sudo certbot certificates
   
   # Renew certificate
   sudo certbot renew
   
   # Test SSL
   openssl s_client -connect yourdomain.com:443
   ```

4. **Database Connection Issues**
   ```bash
   # Check Supabase connection
   curl -X GET "https://yourdomain.com/api/test-db"
   
   # Verify environment variables
   grep SUPABASE .env.local
   ```

### Performance Optimization

1. **Enable Nginx Caching**
2. **Optimize PM2 Cluster Mode**
3. **Setup CDN for Static Assets**
4. **Monitor Memory Usage**
5. **Database Query Optimization**

## Support

For deployment issues:
1. Check application logs: `pm2 logs badge-maker`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables are set correctly
4. Test each external service connection individually
5. Contact support at hello@shinydogproductions.com

---

**Last Updated**: January 2025
**Version**: 1.0.0
