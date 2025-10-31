# Troubleshooting Build Errors

## Module Not Found Errors

If you see errors like:
```
Error: Cannot find module './billing/billing.module'
Error: Cannot find module './gallery/gallery.service'
```

This is usually caused by **stale build artifacts** in the `dist` folder when NestJS watch mode gets out of sync.

## Quick Fix

1. **Stop your dev server** (Ctrl+C or Cmd+C)
2. **Clean and rebuild:**
   ```bash
   npm run clean:build
   ```
3. **Restart dev server:**
   ```bash
   npm run start:dev
   ```

## Prevention

### Option 1: Use the clean start script
```bash
npm run start:dev:clean
```
This automatically cleans before starting in watch mode.

### Option 2: Manual clean when needed
When you see module errors:
```bash
npm run clean
npm run start:dev
```

## Why This Happens

NestJS watch mode uses incremental compilation. Sometimes when:
- Files are added/removed
- Import paths change
- TypeScript compilation gets interrupted

The `dist` folder can get into an inconsistent state. A clean rebuild fixes this.

## Alternative: Full Rebuild

If issues persist:
```bash
# Clean everything
rm -rf dist node_modules/.cache

# Rebuild
npm run build

# Restart
npm run start:dev
```

