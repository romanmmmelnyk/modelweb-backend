# Quick Authentication Guide

## Problem: 401 Unauthorized

You're getting this error because the `/api/billings` endpoint (and most endpoints) require authentication.

## Solution: Login First

### Step 1: Login to Get a Token

**Endpoint:** `POST http://localhost:8210/api/auth/login`

**Request:**
```bash
curl -X POST http://localhost:8210/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Step 2: Use the Token

**For all subsequent requests, add this header:**
```
Authorization: Bearer <your-token-here>
```

**Example:**
```bash
curl -X GET http://localhost:8210/api/billings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## If You Don't Have a User Account

### Option 1: Register
```bash
curl -X POST http://localhost:8210/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"your-password"}'
```

### Option 2: Check Database
You can check your database for existing users or create one via Prisma seed.

## Frontend (Automatic)

If you're using the frontend:
1. Navigate to `/login`
2. Enter your email and password
3. The frontend will automatically store the token and add it to all requests

## Testing with Browser DevTools

1. Open browser DevTools (F12)
2. Go to Console tab
3. Login via the frontend
4. Check Application/Storage → Local Storage → `auth_token`
5. You should see your JWT token there

## Quick Test

```javascript
// In browser console (after logging in via frontend):
const token = localStorage.getItem('auth_token');
console.log('Token:', token);

// Test the API call:
fetch('http://localhost:8210/api/billings', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Common Issues

1. **No token in localStorage** → Login first
2. **Token expired** → Login again
3. **Wrong format** → Must be `Bearer <token>` with space
4. **User inactive** → Contact admin

