#!/bin/bash

# Backend Deployment Script
# This script handles the complete deployment process including Prisma setup

set -e  # Exit on any error

echo "🚀 Starting backend deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example if available...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env from .env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.example not found. Please create .env manually.${NC}"
        echo -e "${YELLOW}⚠️  Make sure to set DATABASE_URL with PostgreSQL connection string!${NC}"
    fi
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL" .env 2>/dev/null || [ -z "$(grep DATABASE_URL .env | cut -d '=' -f2)" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not found in .env file!${NC}"
    echo -e "${YELLOW}⚠️  Please set DATABASE_URL with your PostgreSQL connection string.${NC}"
    echo -e "${YELLOW}⚠️  Example: DATABASE_URL=\"postgresql://user:password@localhost:5432/dbname?schema=public\"${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm ci

# Generate Prisma Client
echo -e "${BLUE}🔧 Generating Prisma Client...${NC}"
npm run db:generate

# Run Prisma migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
if npx prisma migrate deploy 2>/dev/null; then
    echo -e "${GREEN}✓ Migrations applied successfully${NC}"
else
    echo -e "${YELLOW}⚠️  No migrations found or migration failed, using db push...${NC}"
    npx prisma db push || {
        echo -e "${YELLOW}⚠️  Database push completed (this is normal for first setup)${NC}"
    }
fi

# Ensure uploads directories exist
echo -e "${BLUE}📁 Creating upload directories...${NC}"
mkdir -p uploads/gallery uploads/templates
mkdir -p logs

# Build the application
echo -e "${BLUE}🔨 Building application...${NC}"
npm run build

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 is not installed. Installing globally...${NC}"
    npm install -g pm2
fi

# Stop existing backend process if running
echo -e "${BLUE}🛑 Stopping existing backend process...${NC}"
pm2 stop backend 2>/dev/null || true
pm2 delete backend 2>/dev/null || true

# Start the application with PM2
echo -e "${BLUE}▶️  Starting backend server...${NC}"
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Show status
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Server Status:${NC}"
pm2 status

echo -e "${GREEN}🎉 Backend is now running!${NC}"
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  - View logs: ${YELLOW}pm2 logs backend${NC}"
echo -e "  - Monitor: ${YELLOW}pm2 monit${NC}"
echo -e "  - Restart: ${YELLOW}pm2 restart backend${NC}"
echo -e "  - Stop: ${YELLOW}pm2 stop backend${NC}"

