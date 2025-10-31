# Simple Setup Guide

## Step 1: Prepare Your Server

1. SSH into your server:
```bash
ssh your-username@your-server-ip
```

2. Navigate to where you want the backend and clone the repository:
```bash
cd /your/desired/path
git clone https://github.com/romanmmmelnyk/models-backend.git .
# Or if you want it in a subdirectory:
git clone https://github.com/romanmmmelnyk/models-backend.git mwb
cd mwb/management-system/backend
```

3. Install Node.js 20+ (if not already installed):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Install PM2 globally:
```bash
sudo npm install -g pm2
```

5. Setup PM2 to auto-start on boot:
```bash
pm2 startup
# Run the command it outputs
```

## Step 2: Configure Environment

Create `.env` file in the backend directory:
```bash
nano .env
```

Add your configuration:
```env
DATABASE_URL="postgresql://username:password@host:5432/database?schema=public"
PORT=8210
CORS_ORIGINS="http://localhost:5173,https://yourdomain.com"
```

Save: `Ctrl+X`, then `Y`, then `Enter`

## Step 3: First Deployment

```bash
cd /your/path/management-system/backend
chmod +x deploy.sh deploy-restart.sh
npm run deploy
```

This will install everything and start the server.

Verify it's running:
```bash
pm2 status
pm2 logs backend
```

## Step 4: Setup GitHub Actions

1. **Generate SSH key for deployment:**
```bash
ssh-keygen -t ed25519 -C "deployment" -f ~/.ssh/deploy_key
# Press Enter twice (no passphrase needed)
```

2. **Add public key to authorized_keys:**
```bash
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
```

3. **Get your private key:**
```bash
cat ~/.ssh/deploy_key
```
Copy the entire output (including -----BEGIN and -----END lines).

4. **Add GitHub Secrets:**
   - Go to: https://github.com/romanmmmelnyk/models-backend/settings/secrets/actions
   - Click "New repository secret" and add each:
     
     **DEPLOY_HOST** = your-server-ip-or-domain.com
     
     **DEPLOY_USER** = your-ssh-username
     
     **DEPLOY_SSH_KEY** = (paste the private key from step 3)
     
     **DEPLOY_PORT** = 22 (or your SSH port)
     
     **DEPLOY_PATH** = /your/full/path/to/management-system/backend
     
     **DATABASE_URL** = postgresql://username:password@host:5432/database?schema=public
     
   (Use the same DATABASE_URL from your .env file)

## Step 5: Test It!

Make a small change and push:
```bash
git add .
git commit -m "Test deployment"
git push origin main
```

Then check:
- GitHub Actions tab → See the workflow run
- On server: `pm2 logs backend` → See it restart automatically

## Done! 🎉

Every push to `main` or `master` will now automatically:
- Pull latest code
- Install dependencies
- Run Prisma migrations
- Build the app
- Restart the server

## Useful Commands

```bash
pm2 logs backend      # View logs
pm2 restart backend   # Manual restart
pm2 status            # Check status
```

