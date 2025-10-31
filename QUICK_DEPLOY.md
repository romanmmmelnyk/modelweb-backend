# 🚀 Quick Deploy Guide

## First Time Setup

1. **Setup PostgreSQL connection** (if not already done):
   ```bash
   cd management-system/backend
   npm run setup:postgres
   ```
   This will help you configure your DATABASE_URL in .env

2. **Deploy**:
   ```bash
   npm run deploy
   ```

That's it! The script will:
- ✅ Install dependencies
- ✅ Setup Prisma (generate client + migrations)
- ✅ Build the application
- ✅ Start the server with PM2

**Note:** Make sure PostgreSQL is installed and running before deployment!

## Auto-Restart on Every Push

### Option 1: GitHub Actions (Recommended for Cloud Deployment)

1. Add GitHub Secrets in repository settings:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`
2. Push to `main`/`master` branch
3. Server automatically restarts! 🎉

### Option 2: Webhook Server (Recommended for Local/VPS)

1. Start webhook server:
   ```bash
   npm run webhook:server
   # Or with PM2: pm2 start scripts/webhook-server.js --name webhook-server
   ```

2. Configure GitHub Webhook:
   - Settings → Webhooks → Add webhook
   - URL: `http://your-server:9000/webhook`
   - Events: Push events

3. Every push = automatic restart! 🔄

### Option 3: Manual Restart

```bash
npm run deploy:restart
```

## PM2 Commands

```bash
pm2 logs backend      # View logs
pm2 restart backend   # Restart
pm2 stop backend      # Stop
pm2 status            # Status
```

For more details, see [DEPLOYMENT.md](./DEPLOYMENT.md)

