#!/bin/bash

# Setup Docker Secrets for Production Deployment
# This script creates Docker secrets for sensitive data

set -e

echo "🔐 Setting up Docker Secrets for Analytics Service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create a secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    if docker secret ls | grep -q "^${secret_name}"; then
        echo -e "${YELLOW}Secret '${secret_name}' already exists, skipping...${NC}"
    else
        echo "$secret_value" | docker secret create "$secret_name" -
        echo -e "${GREEN}✓ Created secret: ${secret_name} - ${description}${NC}"
    fi
}

# Generate random passwords if not provided
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Check if Docker is in swarm mode
if ! docker info | grep -q "Swarm: active"; then
    echo -e "${RED}❌ Docker is not in swarm mode. Initializing...${NC}"
    docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')
    echo -e "${GREEN}✓ Docker swarm initialized${NC}"
fi

# Database secrets
echo "📊 Creating database secrets..."
DB_PASSWORD=${DB_PASSWORD:-$(generate_password)}
POSTGRES_REPLICATION_PASSWORD=${POSTGRES_REPLICATION_PASSWORD:-$(generate_password)}

create_secret "postgres_password" "$DB_PASSWORD" "PostgreSQL database password"
create_secret "postgres_replication_password" "$POSTGRES_REPLICATION_PASSWORD" "PostgreSQL replication password"

# ClickHouse secrets
echo "🎯 Creating ClickHouse secrets..."
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-$(generate_password)}
create_secret "clickhouse_password" "$CLICKHOUSE_PASSWORD" "ClickHouse database password"

# JWT and application secrets
echo "🔑 Creating application secrets..."
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}
SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -base64 32)}
SUPERSET_SECRET=${SUPERSET_SECRET:-$(openssl rand -base64 32)}

create_secret "jwt_secret" "$JWT_SECRET" "JWT signing secret"
create_secret "session_secret" "$SESSION_SECRET" "Session encryption secret"
create_secret "superset_secret_key" "$SUPERSET_SECRET" "Apache Superset secret key"

# Redis secrets
echo "📝 Creating Redis secrets..."
REDIS_PASSWORD=${REDIS_PASSWORD:-$(generate_password)}
create_secret "redis_password" "$REDIS_PASSWORD" "Redis authentication password"

# Grafana secrets
echo "📈 Creating monitoring secrets..."
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-$(generate_password)}
create_secret "grafana_admin_password" "$GRAFANA_ADMIN_PASSWORD" "Grafana admin password"

# SSL/TLS certificates (if provided)
if [ -f "./ssl/server.crt" ] && [ -f "./ssl/server.key" ]; then
    echo "🔒 Creating SSL certificate secrets..."
    create_secret "ssl_certificate" "$(cat ./ssl/server.crt)" "SSL certificate"
    create_secret "ssl_private_key" "$(cat ./ssl/server.key)" "SSL private key"
else
    echo -e "${YELLOW}⚠️ SSL certificates not found in ./ssl/ directory${NC}"
    echo -e "${YELLOW}   You can add server.crt and server.key later for HTTPS support${NC}"
fi

# API Keys (optional)
if [ ! -z "$OPENAI_API_KEY" ]; then
    create_secret "openai_api_key" "$OPENAI_API_KEY" "OpenAI API key for ML services"
fi

if [ ! -z "$AZURE_API_KEY" ]; then
    create_secret "azure_api_key" "$AZURE_API_KEY" "Azure Cognitive Services API key"
fi

# Create secrets configuration file
echo "📄 Creating secrets configuration..."
cat > secrets-config.env << EOF
# Generated secrets configuration
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Database
POSTGRES_PASSWORD_SECRET=postgres_password
POSTGRES_REPLICATION_PASSWORD_SECRET=postgres_replication_password
CLICKHOUSE_PASSWORD_SECRET=clickhouse_password

# Application
JWT_SECRET_SECRET=jwt_secret
SESSION_SECRET_SECRET=session_secret
REDIS_PASSWORD_SECRET=redis_password

# Monitoring
GRAFANA_ADMIN_PASSWORD_SECRET=grafana_admin_password
SUPERSET_SECRET_KEY_SECRET=superset_secret_key

# SSL (if available)
SSL_CERTIFICATE_SECRET=ssl_certificate
SSL_PRIVATE_KEY_SECRET=ssl_private_key

# External APIs (if configured)
OPENAI_API_KEY_SECRET=openai_api_key
AZURE_API_KEY_SECRET=azure_api_key

# For reference only - actual values are stored in Docker secrets
POSTGRES_PASSWORD_PREVIEW=${DB_PASSWORD:0:8}...
CLICKHOUSE_PASSWORD_PREVIEW=${CLICKHOUSE_PASSWORD:0:8}...
JWT_SECRET_PREVIEW=${JWT_SECRET:0:16}...
GRAFANA_ADMIN_PASSWORD_PREVIEW=${GRAFANA_ADMIN_PASSWORD:0:8}...
EOF

echo -e "${GREEN}✓ Secrets configuration saved to secrets-config.env${NC}"

# List all created secrets
echo ""
echo "📋 Created Docker secrets:"
docker secret ls --format "table {{.Name}}\t{{.CreatedAt}}"

# Create deployment script with secrets
echo ""
echo "🚀 Creating production deployment script..."
cat > deploy-production.sh << 'EOF'
#!/bin/bash

# Production deployment script with secrets
set -e

echo "🚀 Deploying Analytics Service Stack to Production..."

# Ensure we're in swarm mode
if ! docker info | grep -q "Swarm: active"; then
    echo "❌ Docker must be in swarm mode. Run: docker swarm init"
    exit 1
fi

# Build images
echo "🔨 Building application images..."
docker build -t analytics-service:latest .
docker build -t ml-ai-service:latest ./ml-service
docker build -f backup-service/Dockerfile -t backup-service:latest .

# Deploy the stack
echo "📦 Deploying stack..."
docker stack deploy -c docker-swarm-production.yml analytics-stack

echo "✅ Deployment initiated!"
echo ""
echo "📊 Check deployment status:"
echo "   docker stack ps analytics-stack"
echo ""
echo "🌐 Access points:"
echo "   Load Balancer: http://localhost:8080"
echo "   Analytics API: http://localhost:8080/api/"
echo "   ML/AI API: http://localhost:8080/ml/"
echo "   Grafana: http://localhost:8080/grafana/"
echo "   Superset: http://localhost:8080/superset/"
echo ""
echo "🔍 Monitor logs:"
echo "   docker service logs -f analytics-stack_analytics-service"
echo "   docker service logs -f analytics-stack_ml-ai-service"
EOF

chmod +x deploy-production.sh

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Review the generated secrets-config.env file"
echo "2. Add SSL certificates to ./ssl/ directory (optional)"
echo "3. Run './deploy-production.sh' to deploy to production"
echo ""
echo -e "${YELLOW}⚠️ Important security notes:${NC}"
echo "- Never commit secrets-config.env to version control"
echo "- Store backup of secrets in a secure location"
echo "- Rotate passwords regularly in production"
echo "- Use proper SSL certificates in production"
echo ""
echo -e "${GREEN}🔐 All secrets are now stored securely in Docker secrets${NC}"