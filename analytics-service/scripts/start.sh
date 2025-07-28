#!/bin/bash

# Quick start script for Analytics Service
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting CRM Analytics Service...${NC}"

# Navigate to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Start services
docker-compose -f docker-compose.analytics.yml up -d

echo -e "${GREEN}✅ Analytics Service started!${NC}"
echo ""
echo "📊 Available at:"
echo "  Analytics API: http://localhost:8005"
echo "  Grafana:      http://localhost:3001 (admin:admin123)"
echo "  PostHog:      http://localhost:8006"
echo ""
echo "📋 Check status:"
echo "  docker-compose -f docker-compose.analytics.yml ps"
echo "  curl http://localhost:8005/health"