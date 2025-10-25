#!/bin/bash

# Deploy SmartSupport Landing Page
# Author: SmartSupport Team
# Date: 2025-10-23

set -e

echo "🚀 Deploying SmartSupport Landing Page..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Check if landing directory exists
if [ ! -d "landing" ]; then
    print_error "landing directory not found."
    exit 1
fi

print_status "Building and deploying landing page..."

# Build and deploy landing page
docker-compose --env-file .env.prod build landing

print_status "Starting landing page container..."

# Start the landing page service
docker-compose --env-file .env.prod up -d landing

print_status "Checking container health..."

# Wait for container to be healthy
sleep 10

# Check if container is running
if docker ps | grep -q "smart-support-landing"; then
    print_success "Landing page container is running!"
else
    print_error "Failed to start landing page container"
    exit 1
fi

# Check container logs
print_status "Checking container logs..."
docker logs smart-support-landing --tail 10

# Test the landing page
print_status "Testing landing page accessibility..."

# Check if the page is accessible
if curl -f -s "http://localhost/health" > /dev/null; then
    print_success "Landing page is accessible!"
else
    print_warning "Landing page might not be fully ready yet. Please check manually."
fi

print_success "Landing page deployment completed!"

echo ""
echo "🌐 Landing page should be available at:"
echo "   https://smartsupport.vadimevgrafov.ru"
echo ""
echo "📋 To check the status:"
echo "   docker ps | grep smart-support-landing"
echo "   docker logs smart-support-landing"
echo ""
echo "🔄 To update the landing page:"
echo "   1. Edit files in ./landing/"
echo "   2. Run: docker-compose --env-file .env.prod build landing"
echo "   3. Run: docker-compose --env-file .env.prod up -d landing"
echo ""

print_success "Deployment completed successfully! 🎉"

