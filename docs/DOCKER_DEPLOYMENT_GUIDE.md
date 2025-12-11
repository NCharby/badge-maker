# Badge Maker - Docker Deployment Guide

## Overview
This guide covers deploying the Badge Maker application using Docker containers on your Hostinger VPS. Docker provides better isolation, easier deployment, and simplified maintenance compared to traditional server setup.

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

### 1.2 Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker badge-maker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 1.3 Install Certbot for SSL
```bash
# Install Certbot
sudo apt install -y certbot

# Create directory for certificates
sudo mkdir -p /opt/badge-maker/nginx/ssl
sudo chown -R badge-maker:badge-maker /opt/badge-maker
```

## Step 2: Application Deployment

### 2.1 Clone Repository
```bash
# Switch to application user
sudo su - badge-maker

# Clone the repository
cd /opt/badge-maker
git clone https://github.com/yourusername/badge-maker.git .

# Create necessary directories
mkdir -p logs nginx/logs
```

### 2.2 Environment Configuration
```bash
# Copy environment template
cp env.docker .env

# Edit environment variables
nano .env
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

### 2.3 Update Nginx Configuration
The nginx configuration is already set for `badgie.shinydogproductions.com`. No changes needed.

## Step 3: SSL Certificate Setup

### 3.1 Obtain SSL Certificate
```bash
# Get SSL certificate for badgie.shinydogproductions.com
sudo certbot certonly --standalone -d badgie.shinydogproductions.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/badgie.shinydogproductions.com/fullchain.pem /opt/badge-maker/nginx/ssl/
sudo cp /etc/letsencrypt/live/badgie.shinydogproductions.com/privkey.pem /opt/badge-maker/nginx/ssl/

# Set proper permissions
sudo chown -R badge-maker:badge-maker /opt/badge-maker/nginx/ssl/
```

### 3.2 Setup Automatic Certificate Renewal

The SSL renewal script is included in the repository at `scripts/renew-ssl.sh`.

```bash
# Make the script executable (after deploying to server)
sudo chmod +x /opt/badge-maker/scripts/renew-ssl.sh

# Test the script manually first
sudo /opt/badge-maker/scripts/renew-ssl.sh --force

# Add to root crontab for automatic renewal (twice daily check)
sudo crontab -e

# Add this line:
0 0,12 * * * /opt/badge-maker/scripts/renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1
```

**Note:** The script automatically:
- Checks certificate expiration (renews if less than 30 days remaining)
- Temporarily stops nginx container during renewal
- Uses certbot standalone mode for certificate renewal
- Copies certificates to Docker nginx directory
- Restarts nginx container
- Verifies the certificate is working

**Manual Renewal:**
```bash
# Force renewal (even if certificate is still valid)
sudo /opt/badge-maker/scripts/renew-ssl.sh --force

# Check script help
sudo /opt/badge-maker/scripts/renew-ssl.sh --help
```

## Step 4: Database Setup

### 4.1 Supabase Configuration
1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Run Database Schema**: Execute the `supabase/schema.sql` file in your Supabase SQL editor
3. **Configure Storage**: Ensure storage buckets are created and policies are set
4. **Get API Keys**: Copy the project URL and API keys to your `.env` file

### 4.2 Verify Database Connection
```bash
# Test database connection after deployment
curl -X GET "https://badgie.shinydogproductions.com/api/test-db"
```

## Step 5: External Services Setup

### 5.1 Postmark Email Service
1. **Create Postmark Account**: Sign up at [postmarkapp.com](https://postmarkapp.com)
2. **Create Server**: Create a new server in Postmark
3. **Create Template**: Create an email template for badge confirmations
4. **Get API Key**: Copy the server API key to your `.env` file
5. **Verify Sender**: Verify your sender email address

### 5.2 Telegram Bot (Optional)
1. **Create Bot**: Message [@BotFather](https://t.me/botfather) on Telegram
2. **Get Token**: Save the bot token to your `.env` file
3. **Add to Group**: Add the bot to your private group as an administrator
4. **Set Permissions**: Grant "Invite Users via Link" and "Manage Chat" permissions

## Step 6: Deploy Application

### 6.1 Build and Start Containers
```bash
# Build and start all services
docker-compose up -d --build

# Check container status
docker-compose ps

# View logs
docker-compose logs -f badge-maker
```

### 6.2 Verify Deployment
```bash
# Check if application is running
curl -I https://badgie.shinydogproductions.com

# Check health endpoint
curl https://badgie.shinydogproductions.com/health

# Check container health
docker-compose ps
```

## Step 7: Monitoring and Maintenance

### 7.1 Container Management
```bash
# View logs
docker-compose logs -f badge-maker
docker-compose logs -f nginx

# Restart services
docker-compose restart badge-maker
docker-compose restart nginx

# Stop all services
docker-compose down

# Update and restart
docker-compose pull
docker-compose up -d --build
```

### 7.2 Resource Monitoring
```bash
# Monitor container resources
docker stats

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -f
```

### 7.3 Backup Strategy
```bash
# Create backup script
nano /opt/badge-maker/backup.sh
```

**Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/badge-maker"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=logs \
    /opt/badge-maker

# Backup environment file
cp /opt/badge-maker/.env $BACKUP_DIR/env_$DATE.backup

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/app_$DATE.tar.gz"
```

```bash
# Make executable and add to crontab
chmod +x /opt/badge-maker/backup.sh
crontab -e

# Add daily backup at 2 AM:
0 2 * * * /opt/badge-maker/backup.sh
```

## Step 8: Security Hardening

### 8.1 Firewall Configuration
```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Check status
sudo ufw status
```

### 8.2 Container Security
```bash
# Run containers as non-root user (already configured in Dockerfile)
# Use read-only filesystem where possible
# Limit container resources (already configured in docker-compose.yml)
# Regular security updates
```

### 8.3 SSH Security
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

## Step 9: Deployment Commands

### 9.1 Update Application
```bash
# Switch to application user
sudo su - badge-maker

# Navigate to app directory
cd /opt/badge-maker

# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker-compose down
docker-compose up -d --build

# Check status
docker-compose ps
```

### 9.2 Common Docker Commands
```bash
# View logs
docker-compose logs -f badge-maker
docker-compose logs -f nginx

# Restart specific service
docker-compose restart badge-maker

# Stop all services
docker-compose down

# Remove all containers and volumes
docker-compose down -v

# View container resource usage
docker stats

# Execute command in running container
docker-compose exec badge-maker sh
```

## Step 10: Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs badge-maker
   
   # Check environment variables
   cat .env
   
   # Test build locally
   docker-compose build badge-maker
   ```

2. **Nginx 502 Bad Gateway**
   ```bash
   # Check if app container is running
   docker-compose ps
   
   # Check nginx logs
   docker-compose logs nginx
   
   # Test application directly
   docker-compose exec badge-maker curl localhost:3000
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate files
   ls -la nginx/ssl/
   
   # Renew certificates
   sudo certbot renew
   
   # Restart nginx
   docker-compose restart nginx
   ```

4. **Database Connection Issues**
   ```bash
   # Check environment variables
   grep SUPABASE .env
   
   # Test connection from container
   docker-compose exec badge-maker curl localhost:3000/api/test-db
   ```

5. **Memory Issues**
   ```bash
   # Check container memory usage
   docker stats
   
   # Increase memory limits in docker-compose.yml
   # Restart containers
   docker-compose restart
   ```

### Performance Optimization

1. **Enable Docker BuildKit**
   ```bash
   export DOCKER_BUILDKIT=1
   docker-compose build
   ```

2. **Use Multi-stage Builds** (already implemented)
3. **Optimize Nginx Caching**
4. **Monitor Resource Usage**
5. **Regular Container Updates**

## Benefits of Docker Deployment

### ✅ **Advantages Over Traditional Deployment:**

1. **Consistency**: Same environment across all stages
2. **Isolation**: Application runs in its own container
3. **Portability**: Easy to move between servers
4. **Scalability**: Simple horizontal scaling
5. **Rollback**: Easy version management
6. **Dependencies**: All bundled in container
7. **Security**: Process isolation and resource limits
8. **Maintenance**: Simplified updates and monitoring

### 🚀 **Production Features:**

- **Multi-stage Build**: Optimized image size
- **Non-root User**: Enhanced security
- **Health Checks**: Container monitoring
- **Resource Limits**: Memory and CPU constraints
- **Nginx Reverse Proxy**: SSL termination and caching
- **Automatic Updates**: Watchtower integration (optional)
- **Log Management**: Centralized logging
- **Backup Strategy**: Automated backups

## Support

For deployment issues:
1. Check container logs: `docker-compose logs -f badge-maker`
2. Check nginx logs: `docker-compose logs -f nginx`
3. Verify environment variables are set correctly
4. Test each external service connection individually
5. Contact support at hello@shinydogproductions.com

## Quick Reference: Remaining Deployment Steps

Since you've completed through Step 2.2, here are the next steps:

### **Step 3: SSL Certificate Setup**
```bash
# Get SSL certificate
sudo certbot certonly --standalone -d badgie.shinydogproductions.com

# Copy certificates
sudo cp /etc/letsencrypt/live/badgie.shinydogproductions.com/fullchain.pem /opt/badge-maker/nginx/ssl/
sudo cp /etc/letsencrypt/live/badgie.shinydogproductions.com/privkey.pem /opt/badge-maker/nginx/ssl/
sudo chown -R badge-maker:badge-maker /opt/badge-maker/nginx/ssl/
```

### **Step 4: Configure External Services**
1. **Supabase**: Create project, run `supabase/schema.sql`, get API keys
2. **Postmark**: Create account, get API key and template ID
3. **Telegram Bot** (optional): Get bot token from @BotFather

### **Step 5: Deploy Application**
```bash
# Switch to badge-maker user
sudo su - badge-maker
cd /opt/badge-maker

# Make deploy script executable
chmod +x scripts/deploy.sh

# Deploy the application
./scripts/deploy.sh
```

### **Step 6: Verify Deployment**
```bash
# Test the application
curl -I https://badgie.shinydogproductions.com
curl https://badgie.shinydogproductions.com/health

# Check container status
docker-compose ps
```

### **Access Your Application:**
- **Landing Page**: https://badgie.shinydogproductions.com/default/landing
- **COG Classic 2026**: https://badgie.shinydogproductions.com/cog-classic-2026/landing
- **Health Check**: https://badgie.shinydogproductions.com/health

---

**Last Updated**: January 2025
**Version**: 1.0.0
