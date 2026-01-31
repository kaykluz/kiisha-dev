#!/bin/bash

# OpenClaw Integration Rollback Script
# This script handles rollback in case of deployment failure

set -e

# Configuration
ENVIRONMENT=${1:-staging}
BACKUP_DIR=${2:-}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "================================================"
echo "          KIISHA DEPLOYMENT ROLLBACK"
echo "================================================"
echo ""

log_warning "Starting rollback for environment: $ENVIRONMENT"

# Step 1: Stop current services
log_info "Stopping current services..."
docker-compose -f docker-compose.$ENVIRONMENT.yml down
log_success "Services stopped"

# Step 2: Restore database
if [ -f "$BACKUP_DIR/database.sql" ]; then
    log_info "Restoring database from backup..."
    psql $DATABASE_URL < $BACKUP_DIR/database.sql
    log_success "Database restored"
else
    log_warning "No database backup found"
fi

# Step 3: Rollback migrations
log_info "Rolling back database migrations..."
npm run db:rollback --to=0023
log_success "Migrations rolled back"

# Step 4: Restore configuration
if [ -f "$BACKUP_DIR/.env.backup" ]; then
    log_info "Restoring configuration..."
    cp $BACKUP_DIR/.env.backup .env
    log_success "Configuration restored"
fi

# Step 5: Deploy previous version
log_info "Deploying previous version..."

# Get previous version tag
PREVIOUS_VERSION=$(docker images kiisha-app --format "{{.Tag}}" | grep -v $VERSION | head -1)

if [ -z "$PREVIOUS_VERSION" ]; then
    log_error "No previous version found"
    exit 1
fi

log_info "Rolling back to version: $PREVIOUS_VERSION"

# Update docker-compose with previous version
sed -i "s/:latest/:$PREVIOUS_VERSION/g" docker-compose.$ENVIRONMENT.yml

# Start services with previous version
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for services
sleep 10

# Step 6: Verify rollback
log_info "Verifying rollback..."

for service in app discord slack scheduler ai; do
    if docker-compose -f docker-compose.$ENVIRONMENT.yml ps | grep -q "kiisha-$service.*healthy"; then
        log_success "$service is healthy"
    else
        log_error "$service is not healthy after rollback"
    fi
done

# Step 7: Send notifications
log_info "Sending rollback notifications..."

# Discord notification
if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
    curl -X POST $DISCORD_WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d "{
            \"content\": \"⚠️ **Deployment Rolled Back**\",
            \"embeds\": [{
                \"title\": \"Rollback Executed\",
                \"color\": 15158332,
                \"fields\": [
                    {\"name\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"inline\": true},
                    {\"name\": \"Rolled back to\", \"value\": \"$PREVIOUS_VERSION\", \"inline\": true}
                ]
            }]
        }"
fi

# Slack notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST $SLACK_WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d '{
            "text": "⚠️ Deployment rolled back",
            "attachments": [{
                "color": "warning",
                "fields": [
                    {"title": "Environment", "value": "'$ENVIRONMENT'", "short": true},
                    {"title": "Version", "value": "'$PREVIOUS_VERSION'", "short": true}
                ]
            }]
        }'
fi

echo ""
echo "================================================"
echo "          ROLLBACK COMPLETED"
echo "================================================"
echo ""
log_success "System rolled back to version: $PREVIOUS_VERSION"
log_warning "Please investigate the deployment failure"
echo ""

exit 0