#!/usr/bin/env node
/**
 * Simple webhook server for auto-deployment
 * Listens for GitHub webhook calls and automatically deploys
 * 
 * Usage:
 *   node scripts/webhook-server.js
 *   Or use PM2: pm2 start scripts/webhook-server.js --name webhook-server
 * 
 * Set PORT environment variable to change listening port (default: 9000)
 * Set SECRET environment variable for webhook secret verification
 */

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || '';
const DEPLOY_SCRIPT = path.join(__dirname, '..', 'deploy-restart.sh');

function verifySignature(payload, signature) {
  if (!SECRET) return true; // Skip verification if no secret set
  
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function runDeployment(callback) {
  console.log('🚀 Starting deployment...');
  
  exec(`bash ${DEPLOY_SCRIPT}`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Deployment failed:', error);
      callback(error, stderr);
      return;
    }
    
    console.log('✅ Deployment completed successfully');
    console.log(stdout);
    callback(null, stdout);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'] || '';
      
      // Verify signature if secret is configured
      if (SECRET && !verifySignature(body, signature)) {
        console.warn('⚠️  Invalid webhook signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      
      // Check if it's a push event to main/master
      if (payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master') {
        // Check if backend files were changed
        const commits = payload.commits || [];
        const backendChanged = commits.some(commit => 
          commit.modified?.some(file => file.startsWith('management-system/backend/')) ||
          commit.added?.some(file => file.startsWith('management-system/backend/')) ||
          commit.removed?.some(file => file.startsWith('management-system/backend/'))
        );
        
        if (backendChanged || payload.ref) {
          console.log(`📦 Received push to ${payload.ref}, triggering deployment...`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: 'Deployment triggered',
            ref: payload.ref,
            commit: payload.head_commit?.id 
          }));
          
          // Run deployment asynchronously
          runDeployment((error, output) => {
            if (error) {
              console.error('Deployment error:', error);
            }
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'No backend changes, skipping deployment' }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not a main/master branch push' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'webhook-server' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🔔 Webhook server listening on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Webhook endpoint: http://localhost:${PORT}/webhook`);
  if (SECRET) {
    console.log(`   ✅ Secret verification enabled`);
  } else {
    console.log(`   ⚠️  Secret verification disabled (set WEBHOOK_SECRET env var)`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down webhook server...');
  server.close(() => {
    process.exit(0);
  });
});

