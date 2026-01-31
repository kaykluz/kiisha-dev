#!/bin/bash

# OpenClaw Integration Deployment Script
# This script handles the complete deployment process

set -e

# Configuration
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
SKIP_TESTS=${3:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Banner
echo "================================================"
echo "     KIISHA OpenClaw Integration Deployment"
echo "================================================"
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Version: $VERSION"
log_info "Skip Tests: $SKIP_TESTS"
echo ""

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check required tools
for tool in docker docker-compose psql npm gh aws; do
    if ! command -v $tool &> /dev/null; then
        log_error "$tool is not installed"
        exit 1
    fi
done
log_success "All required tools are installed"

# Check environment variables
if [ "$ENVIRONMENT" == "production" ]; then
    required_vars="DATABASE_URL REDIS_URL DISCORD_BOT_TOKEN SLACK_CLIENT_ID ANTHROPIC_API_KEY"
    for var in $required_vars; do
        if [ -z "${!var}" ]; then
            log_error "Environment variable $var is not set"
            exit 1
        fi
    done
fi
log_success "Environment variables are set"

# Step 1: Backup current state
log_info "Creating backup..."
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup database
if [ "$ENVIRONMENT" == "production" ]; then
    log_info "Backing up database..."
    pg_dump $DATABASE_URL > $BACKUP_DIR/database.sql
    log_success "Database backed up to $BACKUP_DIR/database.sql"
fi

# Backup configuration
cp .env $BACKUP_DIR/.env.backup 2>/dev/null || true
log_success "Configuration backed up"

# Step 2: Run tests (unless skipped)
if [ "$SKIP_TESTS" == "false" ]; then
    log_info "Running tests..."

    # Unit tests
    npm run test:unit
    log_success "Unit tests passed"

    # Integration tests
    npm run test:integration
    log_success "Integration tests passed"

    # Security tests
    npm run test:security
    log_success "Security tests passed"
else
    log_warning "Tests skipped - this is not recommended for production!"
fi

# Step 3: Build application
log_info "Building application..."
npm run build
log_success "Application built successfully"

# Step 4: Build Docker images
log_info "Building Docker images..."

docker build -t kiisha-app:$VERSION -f Dockerfile .
docker build -t kiisha-discord:$VERSION -f Dockerfile.discord .
docker build -t kiisha-slack:$VERSION -f Dockerfile.slack .
docker build -t kiisha-scheduler:$VERSION -f Dockerfile.scheduler .
docker build -t kiisha-ai:$VERSION -f Dockerfile.ai .

log_success "Docker images built"

# Step 5: Run database migrations
log_info "Running database migrations..."

# Check for pending migrations
PENDING=$(npm run db:migrate:status --silent | grep -c "pending" || true)
if [ "$PENDING" -gt 0 ]; then
    log_warning "Found $PENDING pending migrations"

    # Run migrations
    npm run db:migrate
    log_success "Migrations completed"

    # Create indexes
    npm run db:index
    log_success "Indexes created"
else
    log_info "No pending migrations"
fi

# Step 6: Deploy services
log_info "Deploying services..."

# Stop old containers
docker-compose -f docker-compose.$ENVIRONMENT.yml down --remove-orphans

# Start new containers
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 10

# Check health
for service in app discord slack scheduler ai; do
    if docker-compose -f docker-compose.$ENVIRONMENT.yml ps | grep -q "kiisha-$service.*healthy"; then
        log_success "$service is healthy"
    else
        log_error "$service is not healthy"
        # Attempt rollback
        ./deploy/rollback.sh $ENVIRONMENT $BACKUP_DIR
        exit 1
    fi
done

# Step 7: Configure channels
log_info "Configuring channel integrations..."

# Discord
if [ ! -z "$DISCORD_BOT_TOKEN" ]; then
    log_info "Configuring Discord..."
    curl -X POST http://localhost:3000/api/discord/register-commands \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN"
    log_success "Discord configured"
fi

# Slack
if [ ! -z "$SLACK_CLIENT_ID" ]; then
    log_info "Configuring Slack..."
    curl -X POST http://localhost:3000/api/slack/configure \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN"
    log_success "Slack configured"
fi

# Step 8: Initialize systems
log_info "Initializing systems..."

# Initialize workflows
curl -X POST http://localhost:3000/api/workflows/init \
    -H "Authorization: Bearer $ADMIN_TOKEN"
log_success "Workflows initialized"

# Set AI budgets
curl -X POST http://localhost:3000/api/ai/budgets/init \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"default_monthly_limit": 1000}'
log_success "AI budgets set"

# Configure rate limits
curl -X POST http://localhost:3000/api/security/rate-limits/init \
    -H "Authorization: Bearer $ADMIN_TOKEN"
log_success "Rate limits configured"

# Step 9: Run smoke tests
log_info "Running smoke tests..."
npm run test:smoke

if [ $? -eq 0 ]; then
    log_success "Smoke tests passed"
else
    log_error "Smoke tests failed"
    ./deploy/rollback.sh $ENVIRONMENT $BACKUP_DIR
    exit 1
fi

# Step 10: Update monitoring
log_info "Updating monitoring..."

# Create Grafana dashboards
for dashboard in deploy/grafana/*.json; do
    curl -X POST http://grafana:3000/api/dashboards/db \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $GRAFANA_TOKEN" \
        -d @$dashboard
done
log_success "Monitoring dashboards created"

# Step 11: Send deployment notification
log_info "Sending deployment notification..."

# Discord notification
if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
    curl -X POST $DISCORD_WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d "{
            \"content\": \"🚀 **OpenClaw Integration Deployed**\",
            \"embeds\": [{
                \"title\": \"Deployment Successful\",
                \"color\": 3066993,
                \"fields\": [
                    {\"name\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"inline\": true},
                    {\"name\": \"Version\", \"value\": \"$VERSION\", \"inline\": true},
                    {\"name\": \"Services\", \"value\": \"✅ All healthy\", \"inline\": true}
                ]
            }]
        }"
fi

# Slack notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST $SLACK_WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d '{
            "text": "🚀 OpenClaw Integration deployed successfully!",
            "attachments": [{
                "color": "good",
                "fields": [
                    {"title": "Environment", "value": "'$ENVIRONMENT'", "short": true},
                    {"title": "Version", "value": "'$VERSION'", "short": true}
                ]
            }]
        }'
fi

# Final summary
echo ""
echo "================================================"
echo "        DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "================================================"
echo ""
log_success "All services deployed and healthy"
log_success "Database migrations completed"
log_success "Channel integrations configured"
log_success "Monitoring updated"
echo ""
echo "Access points:"
echo "  - Main API: http://localhost:3000"
echo "  - Discord Bot: Online"
echo "  - Slack App: Online"
echo "  - Workflow Scheduler: Running"
echo "  - AI Services: Available"
echo ""
echo "Next steps:"
echo "  1. Verify functionality with manual tests"
echo "  2. Monitor logs: docker-compose logs -f"
echo "  3. Check metrics: http://localhost:3000/metrics"
echo "  4. Review alerts: http://grafana:3000"
echo ""
log_info "Deployment completed at $(date)"

# Create deployment record
echo "{
    \"environment\": \"$ENVIRONMENT\",
    \"version\": \"$VERSION\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"status\": \"success\",
    \"services\": {
        \"app\": \"healthy\",
        \"discord\": \"healthy\",
        \"slack\": \"healthy\",
        \"scheduler\": \"healthy\",
        \"ai\": \"healthy\"
    }
}" > $BACKUP_DIR/deployment.json

log_success "Deployment record saved to $BACKUP_DIR/deployment.json"

exit 0