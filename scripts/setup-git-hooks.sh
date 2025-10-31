#!/bin/bash
# Setup git hooks for automatic deployment

set -e

GIT_HOOKS_DIR=".git/hooks"

if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "❌ Error: Not a git repository or .git/hooks directory not found"
    exit 1
fi

# Create post-receive hook
cat > "$GIT_HOOKS_DIR/post-receive" << 'EOF'
#!/bin/bash
# Auto-deploy hook - runs after git push

WORK_DIR="$HOME/backend"  # Change this to your deployment directory
cd "$WORK_DIR" || exit 1

echo "🔄 Pulling latest changes..."
git pull origin main || git pull origin master

echo "🚀 Running deployment..."
bash deploy-restart.sh
EOF

chmod +x "$GIT_HOOKS_DIR/post-receive"

echo "✅ Git hooks configured!"
echo ""
echo "For bare repository setup:"
echo "1. On your server, create a bare repository:"
echo "   git clone --bare <your-repo-url> backend-bare"
echo "2. Copy the post-receive hook to the bare repo's hooks directory"
echo "3. Set WORK_DIR in the hook to your actual backend directory"
echo "4. Push to the bare repository and deployment will run automatically"

