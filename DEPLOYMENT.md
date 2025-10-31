# Backend Deployment Guide

This guide explains how to set up and use the automated CI/CD pipeline for the backend.

## 🚀 Quick Start

### Initial Deployment (First Time Setup)

```bash
cd management-system/backend
npm run deploy
```

This will:
1. Install all dependencies
2. Generate Prisma Client
3. Run database migrations
4. Create necessary directories
5. Build the application
6. Start the server with PM2

### Quick Restart (After Pulling New Code)

```bash
cd management-system/backend
npm run deploy:restart
```

Or use the script directly:
```bash
./deploy-restart.sh
```

## 📋 Prerequisites

1. **Node.js 20+** installed
2. **PM2** installed globally (or it will be auto-installed):
   ```bash
   npm install -g pm2
   ```
3. **Environment Variables**: Create a `.env` file with required variables
4. **PostgreSQL Database**: PostgreSQL database must be set up and accessible

## 🔧 Manual Deployment Steps

If you prefer to deploy manually:

```bash
# 1. Install dependencies
npm ci

# 2. Generate Prisma Client
npm run db:generate

# 3. Run migrations
npm run db:migrate
# Or if migrations don't exist:
npx prisma db push

# 4. Build
npm run build

# 5. Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
```

## 🔄 Automatic CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/backend-deploy.yml`) that:

- **Triggers on**: Push to `main` or `master` branch (only when backend files change)
- **Automatically**:
  1. Installs dependencies
  2. Generates Prisma Client
  3. Runs database migrations
  4. Builds the application
  5. Deploys to your server (if configured)
  6. Restarts the server

### Setting Up GitHub Actions for Deployment

1. **Add GitHub Secrets** (in your repository settings):
   - `DEPLOY_HOST`: Your server IP or domain
   - `DEPLOY_USER`: SSH username
   - `DEPLOY_SSH_KEY`: Private SSH key for deployment
   - `DEPLOY_PORT`: SSH port (default: 22)
   - `DEPLOY_PATH`: Path where backend is deployed (e.g., `~/backend`)
   - `DATABASE_URL`: Database connection string (if different from default)
   - `USE_RSYNC`: Set to `true` if you prefer rsync deployment method

2. **Configure Workflow**:
   - The workflow will automatically trigger on pushes to `main`/`master`
   - It only runs when backend files are modified

### Alternative: Webhook-Based Auto-Deploy

For a simpler setup without GitHub Actions secrets, use the included webhook server:

1. **Start the webhook server** on your deployment machine:
   ```bash
   # Option 1: Run directly
   node scripts/webhook-server.js
   
   # Option 2: Run with PM2 (recommended)
   pm2 start scripts/webhook-server.js --name webhook-server
   pm2 save
   ```

2. **Configure environment variables** (optional but recommended):
   ```bash
   export WEBHOOK_PORT=9000  # Default port
   export WEBHOOK_SECRET="your-secret-key"  # For security
   ```

3. **Configure GitHub Webhook**:
   - Go to your repository Settings → Webhooks → Add webhook
   - Payload URL: `http://your-server:9000/webhook`
   - Content type: `application/json`
   - Secret: (same as WEBHOOK_SECRET if using)
   - Events: Select "Just the push event"
   - Active: ✓

4. **Every push to main/master** will automatically trigger deployment!

The webhook server also provides a health check endpoint:
```bash
curl http://localhost:9000/health
```

## 📊 PM2 Management

After deployment, use PM2 to manage your server:

```bash
# View logs
pm2 logs backend

# Monitor
pm2 monit

# Restart
pm2 restart backend

# Stop
pm2 stop backend

# Status
pm2 status

# View detailed info
pm2 info backend
```

## 🗄️ Database Management

### Migrations
```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Prisma Studio (Database GUI)
```bash
npx prisma studio
```

## 🔍 Troubleshooting

### Server won't start
1. Check if port 8210 is available: `lsof -i :8210`
2. Check PM2 logs: `pm2 logs backend`
3. Verify `.env` file exists and has correct values
4. Ensure PostgreSQL database is accessible and connection string is correct
5. Test database connection: `psql $DATABASE_URL` (or use connection string format)

### Prisma errors
1. Regenerate Prisma Client: `npm run db:generate`
2. Check PostgreSQL connection string in `.env` (must be valid PostgreSQL URL)
3. Verify PostgreSQL server is running: `pg_isready` or check service status
4. Test database connection manually
5. Verify migrations are up to date: `npx prisma migrate status`

### Build errors
1. Clean and rebuild: `npm run clean:build`
2. Clear node_modules and reinstall: `rm -rf node_modules && npm ci`

## 📝 Environment Variables

Required environment variables (add to `.env`):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
PORT=8210
CORS_ORIGINS="http://localhost:5173,http://localhost:8200"
# Add other required variables as needed
```

### PostgreSQL Connection String Format

The DATABASE_URL should follow this format:
```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

Examples:
- Local PostgreSQL: `postgresql://postgres:password@localhost:5432/mydb?schema=public`
- Remote PostgreSQL: `postgresql://user:pass@db.example.com:5432/mydb?schema=public`
- PostgreSQL with SSL: `postgresql://user:pass@host:5432/db?schema=public&sslmode=require`

## 🔐 Security Notes

- Never commit `.env` files
- Keep SSH keys secure
- Use strong database passwords in production
- Regularly update dependencies: `npm audit fix`

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Documentation](https://docs.nestjs.com/)

