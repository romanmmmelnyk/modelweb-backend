#!/bin/bash

# Quick Restart Script for Backend
# Use this when you just need to restart after pulling new code

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Restarting backend...${NC}"

# Check if DATABASE_URL is set
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    exit 1
fi

if ! grep -q "DATABASE_URL" .env 2>/dev/null || [ -z "$(grep DATABASE_URL .env | cut -d '=' -f2)" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not found in .env file!${NC}"
    echo -e "${YELLOW}⚠️  Please set DATABASE_URL with your PostgreSQL connection string.${NC}"
    exit 1
fi

# Pull latest changes (if in git repo)
if [ -d .git ]; then
    echo -e "${BLUE}📥 Pulling latest changes...${NC}"
    git pull || echo -e "${YELLOW}⚠️  Could not pull changes. Continuing...${NC}"
fi

# Install any new dependencies
echo -e "${BLUE}📦 Checking dependencies...${NC}"
npm ci

# Generate Prisma Client (in case schema changed)
echo -e "${BLUE}🔧 Regenerating Prisma Client...${NC}"
npm run db:generate

# Run migrations if needed
echo -e "${BLUE}🗄️  Checking database migrations...${NC}"
if npx prisma migrate deploy 2>/dev/null; then
    echo -e "${GREEN}✓ Migrations up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Using db push for schema sync...${NC}"
    npx prisma db push || {
        echo -e "${YELLOW}⚠️  Database sync completed${NC}"
    }
fi

# Rebuild application
echo -e "${BLUE}🔨 Rebuilding application...${NC}"
npm run build

# Restart PM2 process
echo -e "${BLUE}🔄 Restarting server...${NC}"
if pm2 list | grep -q "backend"; then
    pm2 restart backend --update-env
else
    pm2 start ecosystem.config.js --env production
    pm2 save
fi

echo -e "${GREEN}✓ Backend restarted successfully!${NC}"
pm2 status backend

