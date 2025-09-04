#!/bin/bash

# Badge Maker Docker Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="badge-maker"
APP_DIR="/opt/badge-maker"
BACKUP_DIR="/opt/backups/badge-maker"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as correct user
check_user() {
    if [ "$USER" != "badge-maker" ]; then
        log_error "This script must be run as the 'badge-maker' user"
        log_info "Run: sudo su - badge-maker"
        exit 1
    fi
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Please install Docker first"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        log_info "Please install Docker Compose first"
        exit 1
    fi
    
    log_success "Docker and Docker Compose are installed"
}

# Check if environment file exists
check_env() {
    if [ ! -f "$APP_DIR/.env" ]; then
        log_error "Environment file not found: $APP_DIR/.env"
        log_info "Please copy env.docker to .env and configure it"
        exit 1
    fi
    
    log_success "Environment file found"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup application files
    tar -czf "$BACKUP_DIR/app_$(date +%Y%m%d_%H%M%S).tar.gz" \
        --exclude=node_modules \
        --exclude=.next \
        --exclude=logs \
        --exclude=nginx/logs \
        -C "$APP_DIR" .
    
    # Backup environment file
    cp "$APP_DIR/.env" "$BACKUP_DIR/env_$(date +%Y%m%d_%H%M%S).backup"
    
    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.backup" -mtime +7 -delete
    
    log_success "Backup created"
}

# Pull latest changes
pull_changes() {
    log_info "Pulling latest changes from repository..."
    
    cd "$APP_DIR"
    git pull origin main
    
    log_success "Repository updated"
}

# Build and deploy
deploy() {
    log_info "Building and deploying application..."
    
    cd "$APP_DIR"
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose down
    
    # Build and start new containers
    log_info "Building new containers..."
    docker-compose up -d --build
    
    # Wait for containers to be ready
    log_info "Waiting for containers to be ready..."
    sleep 30
    
    # Check container status
    if docker-compose ps | grep -q "Up"; then
        log_success "Containers are running"
    else
        log_error "Some containers failed to start"
        docker-compose logs
        exit 1
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Check if application responds
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log_success "Application health check passed"
    else
        log_error "Application health check failed"
        docker-compose logs badge-maker
        exit 1
    fi
    
    # Check if nginx responds
    if curl -f -s http://localhost/health > /dev/null; then
        log_success "Nginx health check passed"
    else
        log_error "Nginx health check failed"
        docker-compose logs nginx
        exit 1
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    docker-compose ps
    echo ""
    log_info "Container Resource Usage:"
    docker stats --no-stream
    echo ""
    log_info "Recent Logs:"
    docker-compose logs --tail=20
}

# Main deployment function
main() {
    log_info "Starting Badge Maker deployment..."
    echo ""
    
    check_user
    check_docker
    check_env
    create_backup
    pull_changes
    deploy
    health_check
    show_status
    
    log_success "Deployment completed successfully!"
    log_info "Application is available at: https://yourdomain.com"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "backup")
        check_user
        create_backup
        ;;
    "status")
        check_user
        cd "$APP_DIR"
        show_status
        ;;
    "logs")
        check_user
        cd "$APP_DIR"
        docker-compose logs -f
        ;;
    "restart")
        check_user
        cd "$APP_DIR"
        log_info "Restarting containers..."
        docker-compose restart
        log_success "Containers restarted"
        ;;
    "stop")
        check_user
        cd "$APP_DIR"
        log_info "Stopping containers..."
        docker-compose down
        log_success "Containers stopped"
        ;;
    "help")
        echo "Badge Maker Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  backup   - Create backup only"
        echo "  status   - Show deployment status"
        echo "  logs     - Show container logs"
        echo "  restart  - Restart containers"
        echo "  stop     - Stop containers"
        echo "  help     - Show this help"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for available commands"
        exit 1
        ;;
esac
