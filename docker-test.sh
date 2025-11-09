#!/bin/bash

# Docker Environment Testing Script
# Ensures Docker deployment matches development environment exactly

set -e

echo "=========================================="
echo "Docker Environment Validation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 1. Check if docker-compose is installed
echo "1. Checking prerequisites..."
if command -v docker-compose &> /dev/null; then
    print_status 0 "docker-compose is installed"
else
    print_status 1 "docker-compose is NOT installed"
fi

# 2. Check if storage directory exists
echo ""
echo "2. Checking storage directory..."
if [ -d "./storage" ]; then
    print_status 0 "Storage directory exists"
else
    print_info "Creating storage directory..."
    mkdir -p ./storage
    print_status 0 "Storage directory created"
fi

# 3. Build Docker images
echo ""
echo "3. Building Docker images..."
docker-compose build --no-cache
print_status $? "Docker images built successfully"

# 4. Start services
echo ""
echo "4. Starting Docker services..."
docker-compose up -d
print_status $? "Docker services started"

# 5. Wait for services to be healthy
echo ""
echo "5. Waiting for services to be healthy..."
sleep 10

# Check backend health
echo "   Checking backend health..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$BACKEND_HEALTH" == "200" ]; then
    print_status 0 "Backend is healthy (HTTP $BACKEND_HEALTH)"
else
    print_status 1 "Backend is NOT healthy (HTTP $BACKEND_HEALTH)"
fi

# Check frontend health
echo "   Checking frontend health..."
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8064/health)
if [ "$FRONTEND_HEALTH" == "200" ]; then
    print_status 0 "Frontend is healthy (HTTP $FRONTEND_HEALTH)"
else
    print_status 1 "Frontend is NOT healthy (HTTP $FRONTEND_HEALTH)"
fi

# 6. Test API endpoints
echo ""
echo "6. Testing API endpoints..."

# Test settings endpoint
SETTINGS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8064/api/settings)
if [ "$SETTINGS_RESPONSE" == "200" ]; then
    print_status 0 "Settings API is accessible (HTTP $SETTINGS_RESPONSE)"
else
    print_status 1 "Settings API is NOT accessible (HTTP $SETTINGS_RESPONSE)"
fi

# Test projects endpoint
PROJECTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8064/api/projects)
if [ "$PROJECTS_RESPONSE" == "200" ]; then
    print_status 0 "Projects API is accessible (HTTP $PROJECTS_RESPONSE)"
else
    print_status 1 "Projects API is NOT accessible (HTTP $PROJECTS_RESPONSE)"
fi

# 7. Check database
echo ""
echo "7. Checking database..."
if docker-compose exec -T api ls /app/storage/app.db &> /dev/null; then
    print_status 0 "Database file exists in container"
else
    print_info "Database will be created on first API call"
fi

# 8. Display running containers
echo ""
echo "8. Running containers:"
docker-compose ps

# 9. Show recent logs
echo ""
echo "9. Recent logs:"
echo "--- Backend logs ---"
docker-compose logs --tail=10 api
echo ""
echo "--- Frontend logs ---"
docker-compose logs --tail=10 frontend

echo ""
echo "=========================================="
echo -e "${GREEN}✓ Docker environment is ready!${NC}"
echo "=========================================="
echo ""
echo "Services:"
echo "  Frontend: http://localhost:8064"
echo "  Backend:  http://localhost:3001"
echo ""
echo "Commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop:          docker-compose down"
echo "  Restart:       docker-compose restart"
echo "  Rebuild:       docker-compose up -d --build"
echo ""
