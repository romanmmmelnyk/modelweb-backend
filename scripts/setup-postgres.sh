#!/bin/bash
# PostgreSQL Setup Script for Backend
# This script helps set up PostgreSQL database for the backend

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🗄️  PostgreSQL Setup Helper${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}PostgreSQL client (psql) not found.${NC}"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS: brew install postgresql"
    echo "  Or download from: https://www.postgresql.org/download/"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL client found${NC}"
echo ""

# Prompt for database details
read -p "PostgreSQL host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "PostgreSQL port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name [mwb_backend]: " DB_NAME
DB_NAME=${DB_NAME:-mwb_backend}

read -p "Database user [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Database password: " DB_PASSWORD
echo ""

read -p "Database schema [public]: " DB_SCHEMA
DB_SCHEMA=${DB_SCHEMA:-public}

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}"

echo ""
echo -e "${BLUE}Creating database if it doesn't exist...${NC}"

# Try to create database (will fail if it exists, which is fine)
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
    echo -e "${YELLOW}Database might already exist (this is OK)${NC}"
}

echo -e "${GREEN}✓ Database ready${NC}"
echo ""

# Update or create .env file
if [ -f .env ]; then
    if grep -q "^DATABASE_URL=" .env; then
        # Update existing DATABASE_URL
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" .env
        else
            # Linux
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" .env
        fi
        echo -e "${GREEN}✓ Updated DATABASE_URL in .env${NC}"
    else
        # Append DATABASE_URL
        echo "DATABASE_URL=\"${DATABASE_URL}\"" >> .env
        echo -e "${GREEN}✓ Added DATABASE_URL to .env${NC}"
    fi
else
    # Create .env file
    echo "DATABASE_URL=\"${DATABASE_URL}\"" > .env
    echo "PORT=8210" >> .env
    echo "" >> .env
    echo "# Add other environment variables here" >> .env
    echo -e "${GREEN}✓ Created .env file with DATABASE_URL${NC}"
fi

echo ""
echo -e "${GREEN}✅ PostgreSQL setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run migrations: npm run db:migrate"
echo "2. Or use db push: npx prisma db push"
echo "3. Deploy: npm run deploy"

