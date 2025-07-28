#!/bin/bash

# Stop script for Analytics Service
set -e

RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping CRM Analytics Service...${NC}"

# Navigate to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Stop services
docker-compose -f docker-compose.analytics.yml down

echo -e "${RED}⛔ Analytics Service stopped!${NC}"