#!/bin/bash

# Badge Maker SSL Certificate Renewal Script
# This script renews SSL certificates and restarts the nginx container

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/badge-maker"
DOMAIN="badgie.shinydogproductions.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_SSL_DIR="${APP_DIR}/nginx/ssl"

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

# Check if running as root (required for certbot)
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        log_info "Run: sudo $0"
        exit 1
    fi
}

# Check if certbot is installed
check_certbot() {
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot is not installed"
        log_info "Install with: sudo apt install certbot"
        exit 1
    fi
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
}

# Check certificate expiration
check_certificate_expiration() {
    log_info "Checking current certificate expiration..."
    
    if [ -f "${CERT_DIR}/cert.pem" ]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "${CERT_DIR}/cert.pem" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
        
        log_info "Certificate expires: $EXPIRY_DATE"
        log_info "Days until expiry: $DAYS_UNTIL_EXPIRY"
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            log_warning "Certificate expires in less than 30 days. Renewal recommended."
            return 0  # Should renew
        else
            log_info "Certificate is still valid for more than 30 days."
            return 1  # No need to renew yet
        fi
    else
        log_warning "Certificate file not found. Will attempt to obtain new certificate."
        return 0  # Should renew/obtain
    fi
}

# Renew SSL certificate
renew_certificate() {
    log_info "Renewing SSL certificate for ${DOMAIN}..."
    
    # Check if nginx container is running
    if docker ps | grep -q "badge-maker-nginx"; then
        log_info "Nginx container is running. Using standalone mode for renewal..."
        
        # Stop nginx container temporarily to free up ports 80/443
        log_info "Temporarily stopping nginx container..."
        cd "${APP_DIR}"
        docker-compose stop nginx || true
        
        # Renew certificate using standalone mode
        if certbot renew --cert-name "${DOMAIN}" --standalone --quiet --non-interactive; then
            log_success "Certificate renewed successfully"
        else
            log_error "Certificate renewal failed"
            # Try to start nginx again even if renewal failed
            docker-compose start nginx || true
            exit 1
        fi
        
        # Start nginx container again
        log_info "Starting nginx container..."
        docker-compose start nginx || true
    else
        log_info "Nginx container is not running. Using standalone mode..."
        certbot renew --cert-name "${DOMAIN}" --standalone --quiet --non-interactive || {
            log_error "Certificate renewal failed"
            exit 1
        }
    fi
}

# Copy certificates to Docker nginx directory
copy_certificates() {
    log_info "Copying certificates to Docker nginx directory..."
    
    # Ensure nginx ssl directory exists
    mkdir -p "${NGINX_SSL_DIR}"
    
    # Copy certificate files
    if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
        cp "${CERT_DIR}/fullchain.pem" "${NGINX_SSL_DIR}/fullchain.pem"
        cp "${CERT_DIR}/privkey.pem" "${NGINX_SSL_DIR}/privkey.pem"
        
        # Set proper permissions
        chown -R badge-maker:badge-maker "${NGINX_SSL_DIR}"
        chmod 644 "${NGINX_SSL_DIR}/fullchain.pem"
        chmod 600 "${NGINX_SSL_DIR}/privkey.pem"
        
        log_success "Certificates copied to ${NGINX_SSL_DIR}"
    else
        log_error "Certificate files not found in ${CERT_DIR}"
        exit 1
    fi
}

# Restart nginx container
restart_nginx() {
    log_info "Restarting nginx container to load new certificates..."
    
    cd "${APP_DIR}"
    
    # Check if running as badge-maker user would be better, but we're root
    # So we'll use docker-compose directly
    if docker-compose restart nginx; then
        log_success "Nginx container restarted successfully"
    else
        log_warning "Failed to restart nginx container with docker-compose"
        log_info "Attempting direct docker restart..."
        docker restart badge-maker-nginx || {
            log_error "Failed to restart nginx container"
            exit 1
        }
    fi
    
    # Wait a moment for nginx to start
    sleep 3
    
    # Verify nginx is running
    if docker ps | grep -q "badge-maker-nginx"; then
        log_success "Nginx container is running"
    else
        log_error "Nginx container failed to start"
        exit 1
    fi
}

# Verify certificate
verify_certificate() {
    log_info "Verifying SSL certificate..."
    
    # Wait a moment for nginx to fully start
    sleep 2
    
    # Check if certificate is valid
    if openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        log_success "SSL certificate is valid and working"
    else
        log_warning "Could not verify certificate remotely (this may be normal if DNS is not accessible)"
        log_info "Certificate files have been updated. Please verify manually with:"
        log_info "  openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN}"
    fi
}

# Main execution
main() {
    log_info "Starting SSL certificate renewal for ${DOMAIN}..."
    echo ""
    
    check_root
    check_certbot
    check_docker_compose
    
    # Check if renewal is needed (unless --force is used)
    if [ "$1" != "--force" ]; then
        if ! check_certificate_expiration; then
            log_info "Certificate is still valid. Use --force to renew anyway."
            exit 0
        fi
    else
        log_info "Force renewal requested..."
    fi
    
    renew_certificate
    copy_certificates
    restart_nginx
    verify_certificate
    
    echo ""
    log_success "SSL certificate renewal completed successfully!"
    log_info "Certificate expiration: $(openssl x509 -enddate -noout -in "${CERT_DIR}/cert.pem" | cut -d= -f2)"
}

# Handle command line arguments
case "${1:-}" in
    "--force")
        main --force
        ;;
    "--help"|"-h")
        echo "Badge Maker SSL Certificate Renewal Script"
        echo ""
        echo "Usage: sudo $0 [options]"
        echo ""
        echo "Options:"
        echo "  (no args)  - Renew certificate if expires in less than 30 days"
        echo "  --force    - Force renewal even if certificate is still valid"
        echo "  --help     - Show this help message"
        echo ""
        echo "This script will:"
        echo "  1. Check certificate expiration"
        echo "  2. Renew the SSL certificate using Certbot"
        echo "  3. Copy certificates to Docker nginx directory"
        echo "  4. Restart the nginx container"
        echo ""
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        log_info "Run '$0 --help' for usage information"
        exit 1
        ;;
esac

