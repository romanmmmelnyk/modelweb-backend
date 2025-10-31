# Production Deployment Guide

## Quick Start

### 1. Build for Production

```bash
npm run clean:build
```

This will:
- Clean the dist folder
- Build the production-ready TypeScript code
- Remove comments and source maps for smaller bundle

### 2. Start with PM2 (Recommended)

```bash
# Start production server
npm run start:pm2

# Or for development mode
npm run start:pm2:dev

# Check status
pm2 status

# View logs
pm2 logs backend

# Restart if needed
npm run restart:pm2

# Stop server
npm run stop:pm2
```

### 3. Alternative: Node.js Direct

```bash
npm run start:prod
```

## Environment Setup

Make sure your `.env` file has all required variables:

```env
DATABASE_URL="postgresql://..."
PORT=8210
NODE_ENV=production

JWT_SECRET="your-production-secret"
JWT_EXPIRES_IN="7d"

STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_WEBHOOK_ENDPOINT="https://your-domain.com/api/applications/webhook"

SENDGRID_API_KEY="SG."
FROM_EMAIL="noreply@moth.solutions"

ADMIN_TOKEN="your-production-admin-token"
FRONTEND_URL="https://your-domain.com"

CORS_ORIGINS="https://your-domain.com,https://www.your-domain.com"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="https://your-domain.com/auth/google/callback"
```

## Stripe Webhook Configuration

### Webhook Endpoint
Your Stripe webhook endpoint is automatically available at:
```
POST /api/applications/webhook
```

### Required Events
Configure these events in your Stripe Dashboard:
- `checkout.session.completed` - When payment succeeds
- `customer.subscription.updated` - When subscription changes
- `customer.subscription.deleted` - When subscription cancels
- `invoice.payment_succeeded` - When recurring payment succeeds
- `invoice.payment_failed` - When payment fails

### Testing Webhooks
1. Use Stripe CLI: `stripe listen --forward-to localhost:8210/api/applications/webhook`
2. Or use Stripe Dashboard → Webhooks → Add endpoint

## PM2 Advanced Usage

### Save PM2 Configuration
```bash
pm2 save
pm2 startup
```

### Monitor Performance
```bash
pm2 monit
```

### Cluster Mode (for high traffic)
Edit `ecosystem.config.js`:
```javascript
instances: 'max',  // Use all CPU cores
```

## Health Checks

Check if backend is running:
```bash
curl http://localhost:8210/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.45,
  "environment": "production",
  "checks": {
    "database": "healthy"
  }
}
```

## Database Migrations

Before deploying, run migrations:
```bash
npm run db:migrate
```

## Security Checklist

- [ ] Change all default secrets (JWT_SECRET, ADMIN_TOKEN)
- [ ] Use strong passwords for database
- [ ] Enable HTTPS in production
- [ ] Configure CORS_ORIGINS properly
- [ ] Set up firewall rules
- [ ] Enable rate limiting (if needed)
- [ ] Set up log rotation
- [ ] Configure backup strategy
- [ ] Set up monitoring (e.g., PM2 monitoring, New Relic, etc.)
- [ ] Enable 2FA for admin accounts

## Performance Optimization

1. **Database**: Use connection pooling
2. **Caching**: Add Redis for sessions
3. **CDN**: Use CloudFlare or AWS CloudFront for static assets
4. **Monitoring**: Set up APM (Application Performance Monitoring)

## Troubleshooting

### Server won't start
```bash
# Check logs
pm2 logs backend --lines 50

# Check if port is in use
lsof -i :8210

# Verify .env file
cat .env
```

### Database connection fails
```bash
# Test database connection
npm run db:push

# Check Prisma
npx prisma db pull
```

### Memory issues
Adjust in `ecosystem.config.js`:
```javascript
max_memory_restart: '2G'  // Increase if needed
```

## Deployment Scripts

Use the provided scripts:
- `npm run deploy` - Full deployment
- `npm run deploy:restart` - Quick restart

## Rollback

If something goes wrong:
```bash
pm2 stop backend
git checkout previous-commit-hash
npm run clean:build
npm run start:pm2
```

## Useful Commands

```bash
# View all processes
pm2 list

# Delete process
pm2 delete backend

# Flush logs
pm2 flush

# Reload app (zero downtime)
pm2 reload backend

# Generate PM2 startup script
pm2 startup
```

