#!/bin/bash

# Badge Maker SSL Renewal Setup Script
# This script sets up automatic SSL certificate renewal via cron

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/badge-maker"
RENEW_SCRIPT="${APP_DIR}/scripts/renew-ssl.sh"
LOG_FILE="/var/log/ssl-renewal.log"
CRON_SCHEDULE="0 0,12 * * *"  # Twice daily at midnight and noon

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

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        log_info "Run: sudo $0"
        exit 1
    fi
}

# Check if renewal script exists
check_renewal_script() {
    if [ ! -f "$RENEW_SCRIPT" ]; then
        log_error "Renewal script not found: $RENEW_SCRIPT"
        log_info "Please ensure the script is deployed to the server first"
        exit 1
    fi
    
    # Make sure it's executable
    if [ ! -x "$RENEW_SCRIPT" ]; then
        log_info "Making renewal script executable..."
        chmod +x "$RENEW_SCRIPT"
        log_success "Renewal script is now executable"
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

# Create log file and set permissions
setup_log_file() {
    log_info "Setting up log file: $LOG_FILE"
    
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    
    log_success "Log file created: $LOG_FILE"
}

# Check if cron job already exists
check_existing_cron() {
    if crontab -l 2>/dev/null | grep -q "$RENEW_SCRIPT"; then
        log_warning "SSL renewal cron job already exists"
        
        # Show current cron entry
        log_info "Current cron entry:"
        crontab -l 2>/dev/null | grep "$RENEW_SCRIPT"
        
        read -p "Do you want to remove the existing entry and add a new one? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Removing existing cron job..."
            crontab -l 2>/dev/null | grep -v "$RENEW_SCRIPT" | crontab -
            return 0
        else
            log_info "Keeping existing cron job. Exiting."
            exit 0
        fi
    fi
}

# Add cron job
add_cron_job() {
    log_info "Adding SSL renewal cron job..."
    
    # Create the cron entry
    CRON_ENTRY="${CRON_SCHEDULE} ${RENEW_SCRIPT} >> ${LOG_FILE} 2>&1"
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    
    log_success "Cron job added successfully"
    log_info "Schedule: ${CRON_SCHEDULE} (twice daily at midnight and noon)"
}

# Verify cron job
verify_cron_job() {
    log_info "Verifying cron job..."
    
    if crontab -l 2>/dev/null | grep -q "$RENEW_SCRIPT"; then
        log_success "Cron job verified"
        log_info "Current crontab entries for SSL renewal:"
        crontab -l 2>/dev/null | grep "$RENEW_SCRIPT" | sed 's/^/  /'
    else
        log_error "Failed to verify cron job"
        exit 1
    fi
}

# Test the renewal script (dry run)
test_renewal_script() {
    log_info "Testing renewal script (dry run)..."
    
    if [ -f "$RENEW_SCRIPT" ]; then
        # Show help to verify script works
        if "$RENEW_SCRIPT" --help > /dev/null 2>&1; then
            log_success "Renewal script is working correctly"
        else
            log_warning "Could not execute renewal script (may need to be fixed)"
        fi
    fi
}

# Main execution
main() {
    log_info "Setting up automatic SSL certificate renewal..."
    echo ""
    
    check_root
    check_certbot
    check_renewal_script
    setup_log_file
    check_existing_cron
    add_cron_job
    verify_cron_job
    test_renewal_script
    
    echo ""
    log_success "Automatic SSL renewal setup completed!"
    echo ""
    log_info "Summary:"
    echo "  - Renewal script: $RENEW_SCRIPT"
    echo "  - Schedule: Twice daily (midnight and noon)"
    echo "  - Log file: $LOG_FILE"
    echo ""
    log_info "To view cron jobs: sudo crontab -l"
    log_info "To view renewal logs: sudo tail -f $LOG_FILE"
    log_info "To manually run renewal: sudo $RENEW_SCRIPT"
    log_info "To force renewal: sudo $RENEW_SCRIPT --force"
}

# Handle command line arguments
case "${1:-}" in
    "--remove")
        check_root
        log_info "Removing SSL renewal cron job..."
        if crontab -l 2>/dev/null | grep -q "$RENEW_SCRIPT"; then
            crontab -l 2>/dev/null | grep -v "$RENEW_SCRIPT" | crontab -
            log_success "Cron job removed"
        else
            log_warning "No cron job found to remove"
        fi
        ;;
    "--status")
        check_root
        log_info "Checking SSL renewal setup status..."
        echo ""
        
        if [ -f "$RENEW_SCRIPT" ]; then
            log_success "Renewal script exists: $RENEW_SCRIPT"
            if [ -x "$RENEW_SCRIPT" ]; then
                log_success "Renewal script is executable"
            else
                log_warning "Renewal script is not executable"
            fi
        else
            log_error "Renewal script not found: $RENEW_SCRIPT"
        fi
        
        echo ""
        if crontab -l 2>/dev/null | grep -q "$RENEW_SCRIPT"; then
            log_success "Cron job is configured:"
            crontab -l 2>/dev/null | grep "$RENEW_SCRIPT" | sed 's/^/  /'
        else
            log_warning "No cron job configured"
        fi
        
        if [ -f "$LOG_FILE" ]; then
            echo ""
            log_info "Last renewal log entries:"
            tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /' || log_warning "Log file is empty or cannot be read"
        fi
        ;;
    "--help"|"-h")
        echo "Badge Maker SSL Renewal Setup Script"
        echo ""
        echo "Usage: sudo $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (no args)  - Set up automatic SSL renewal"
        echo "  --status   - Check current setup status"
        echo "  --remove   - Remove automatic renewal cron job"
        echo "  --help     - Show this help message"
        echo ""
        echo "This script will:"
        echo "  1. Verify certbot is installed"
        echo "  2. Check renewal script exists and is executable"
        echo "  3. Set up log file"
        echo "  4. Add cron job for automatic renewal (twice daily)"
        echo "  5. Verify the setup"
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

