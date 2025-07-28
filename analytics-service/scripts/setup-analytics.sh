#!/bin/bash

# CRM Analytics Service Setup Script
# Настройка БЕСПЛАТНОЙ аналитической системы с Grafana, PostHog и PostgreSQL

set -e  # Exit on error

echo "🚀 Setting up FREE Analytics Stack for CRM..."
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
GRAFANA_PORT=3001
POSTHOG_PORT=8006
ANALYTICS_PORT=8005
REDIS_PORT=6380

echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1

    echo -e "${YELLOW}Waiting for $name to be ready at $url...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

if ! command_exists curl; then
    echo -e "${RED}❌ curl is not installed. Please install curl first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies are installed${NC}"

# Navigate to project directory
cd "$PROJECT_DIR"

# Create necessary directories
echo -e "${BLUE}Creating directory structure...${NC}"
mkdir -p logs
mkdir -p grafana/dashboards
mkdir -p grafana/provisioning/{dashboards,datasources}
mkdir -p nginx

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cat > .env << EOF
# Analytics Service Configuration
NODE_ENV=production
PORT=8000

# Database (same as Kotlin core)
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=salesforce_clone
DB_USERNAME=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=redis-analytics
REDIS_PORT=6379
REDIS_DB=1

# PostHog (self-hosted)
POSTHOG_HOST=http://posthog-analytics:8000
POSTHOG_API_KEY=phc_dummy_key
POSTHOG_ENABLED=true

# JWT (same as Kotlin core)
JWT_SECRET=bXlfc2VjcmV0X2tleV9mb3Jfand0X3Rva2Vux2dlbmVyYXRpb25fMTIzNDU2Nzg5MA==

# Analytics Configuration
ANALYTICS_BATCH_SIZE=100
ANALYTICS_FLUSH_INTERVAL=10000
METRICS_REFRESH_INTERVAL=60000
ENABLE_REALTIME=true

# Security
ENABLE_CORS=true
CORS_ORIGIN=http://localhost:3000,http://localhost:8080
RATE_LIMIT_REQUESTS=1000

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Create nginx configuration
echo -e "${BLUE}Creating nginx configuration...${NC}"
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream analytics {
        server analytics-service:8000;
    }
    
    upstream grafana {
        server grafana-analytics:3000;
    }
    
    upstream posthog {
        server posthog-analytics:8000;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Analytics API
        location /api/ {
            proxy_pass http://analytics;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # WebSocket for real-time analytics
        location /ws {
            proxy_pass http://analytics;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
        
        # Grafana
        location /grafana/ {
            proxy_pass http://grafana/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # PostHog
        location /posthog/ {
            proxy_pass http://posthog/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # Health check
        location /health {
            proxy_pass http://analytics/health;
        }
        
        # Default route
        location / {
            return 200 '{"message": "CRM Analytics Stack", "services": {"analytics": "/api/", "grafana": "/grafana/", "posthog": "/posthog/", "health": "/health"}}';
            add_header Content-Type application/json;
        }
    }
}
EOF

# Install npm dependencies
echo -e "${BLUE}Installing npm dependencies...${NC}"
if [ -f package.json ]; then
    npm install
    echo -e "${GREEN}✅ npm dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  package.json not found, skipping npm install${NC}"
fi

# Build TypeScript
echo -e "${BLUE}Building TypeScript...${NC}"
if [ -f tsconfig.json ]; then
    npm run build || echo -e "${YELLOW}⚠️  TypeScript build failed or not configured${NC}"
fi

# Stop any existing services
echo -e "${BLUE}Stopping existing services...${NC}"
docker-compose -f docker-compose.analytics.yml down -v || true

# Pull latest images
echo -e "${BLUE}Pulling latest Docker images...${NC}"
docker-compose -f docker-compose.analytics.yml pull

# Start services
echo -e "${BLUE}Starting analytics services...${NC}"
docker-compose -f docker-compose.analytics.yml up -d

# Wait for services to be ready
echo -e "${BLUE}Waiting for services to start...${NC}"
sleep 10

# Check Redis
wait_for_service "http://localhost:$REDIS_PORT" "Redis" 15 || echo -e "${YELLOW}⚠️  Redis health check failed${NC}"

# Check Analytics Service
wait_for_service "http://localhost:$ANALYTICS_PORT/health" "Analytics Service" 30

# Check Grafana
wait_for_service "http://localhost:$GRAFANA_PORT/api/health" "Grafana" 45

# Check PostHog (may take longer to start)
wait_for_service "http://localhost:$POSTHOG_PORT/_health" "PostHog" 60 || echo -e "${YELLOW}⚠️  PostHog health check failed, it may still be starting${NC}"

# Run database migrations
echo -e "${BLUE}Running database migrations...${NC}"
docker exec crm-analytics npm run migrate || echo -e "${YELLOW}⚠️  Migration failed or not configured${NC}"

# Seed sample data
echo -e "${BLUE}Seeding sample analytics data...${NC}"
docker exec crm-analytics npm run seed || echo -e "${YELLOW}⚠️  Seeding failed or not configured${NC}"

# Import Grafana dashboards
echo -e "${BLUE}Setting up Grafana dashboards...${NC}"
sleep 5  # Give Grafana a moment to fully initialize

# The dashboards will be automatically loaded via provisioning
echo -e "${GREEN}✅ Grafana dashboards will be automatically provisioned${NC}"

echo ""
echo -e "${GREEN}🎉 FREE Analytics Stack is ready!${NC}"
echo "======================================"
echo ""
echo -e "${BLUE}📊 Service URLs:${NC}"
echo "  Analytics API:    http://localhost:$ANALYTICS_PORT"
echo "  API Documentation: http://localhost:$ANALYTICS_PORT/api/docs"
echo "  Health Check:     http://localhost:$ANALYTICS_PORT/health"
echo "  WebSocket:        ws://localhost:$ANALYTICS_PORT/ws"
echo ""
echo -e "${BLUE}📈 Dashboard URLs:${NC}"
echo "  Grafana:          http://localhost:$GRAFANA_PORT"
echo "    Username: admin"
echo "    Password: admin123"
echo ""
echo "  PostHog:          http://localhost:$POSTHOG_PORT"
echo ""
echo "  Nginx Proxy:      http://localhost:8080"
echo ""
echo -e "${BLUE}🔧 Service Ports:${NC}"
echo "  Redis:            localhost:$REDIS_PORT"
echo "  PostgreSQL:       localhost:5432 (shared with CRM)"
echo ""
echo -e "${BLUE}📋 Quick Test:${NC}"
echo "  curl http://localhost:$ANALYTICS_PORT/health"
echo ""
echo -e "${BLUE}🐳 Docker Commands:${NC}"
echo "  View logs:        docker-compose -f docker-compose.analytics.yml logs -f"
echo "  Stop services:    docker-compose -f docker-compose.analytics.yml down"
echo "  Restart:          docker-compose -f docker-compose.analytics.yml restart"
echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo -e "${YELLOW}💡 TIP: Check the logs with 'docker-compose -f docker-compose.analytics.yml logs -f' if any service isn't working${NC}"
echo ""

# Final health check
echo -e "${BLUE}Final health check...${NC}"
if curl -f -s "http://localhost:$ANALYTICS_PORT/health" >/dev/null; then
    echo -e "${GREEN}✅ Analytics Service is responding${NC}"
else
    echo -e "${RED}❌ Analytics Service is not responding${NC}"
    echo -e "${YELLOW}Check the logs: docker-compose -f docker-compose.analytics.yml logs analytics-service${NC}"
fi