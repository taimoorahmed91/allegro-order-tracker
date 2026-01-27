# Authentication Setup Guide

## Overview
Your Order Dashboard now has username/password authentication powered by Supabase.

## Setup Instructions

### Step 1: Create Users Table in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the SQL script from `users-schema.sql`

This will create:
- A `users` table with username and password_hash columns
- 3 default user accounts (see below)
- Proper indexes and security policies

### Step 2: Install Dependencies

Run this command to install the authentication library:

```bash
npm install
```

This will install `bcryptjs` for password hashing.

### Step 3: Test the Application

Run the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` and you'll see the login page.

## Default User Accounts

Three users are created by default (all with password: `password123`):

| Username | Password     | Role  |
|----------|-------------|-------|
| admin    | password123 | Admin |
| user1    | password123 | User  |
| demo     | password123 | Demo  |

**⚠️ IMPORTANT:** Change these passwords in production!

## How It Works

### Login Flow:
1. User enters username and password
2. API checks credentials against Supabase users table
3. Password is verified using bcrypt
4. Session stored in browser localStorage
5. Dashboard loads with user's name displayed

### Logout Flow:
1. User clicks "Logout" button in header
2. Session cleared from localStorage
3. User redirected to login page

### Session Persistence:
- Login persists across page refreshes
- Stored in browser localStorage
- Auto-logout on browser close (can be configured)

## Security Features

✅ **Password Hashing** - Passwords stored as bcrypt hashes (not plain text)
✅ **Secure API** - Backend validates credentials
✅ **SQL Injection Protection** - Supabase handles parameterized queries
✅ **Row Level Security** - Enabled on users table

## Customization

### Adding New Users

Run this SQL in Supabase to add new users:

```sql
-- Generate password hash (use bcrypt with salt rounds = 10)
-- For 'mypassword', the hash is shown below
INSERT INTO users (username, password_hash) VALUES
  ('newuser', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
```

### Changing Passwords

To hash a new password, you can use an online bcrypt generator or Node.js:

```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your-new-password', 10);
console.log(hash);
```

Then update in Supabase:

```sql
UPDATE users
SET password_hash = 'your-new-hash-here'
WHERE username = 'admin';
```

### Removing Authentication

To disable authentication temporarily:

1. Edit `pages/index.tsx`
2. Change `return <Dashboard username={username} onLogout={handleLogout} />;`
   to `return <Dashboard username="Guest" onLogout={() => {}} />;`
3. Return `true` instead of checking localStorage

## Troubleshooting

### "Invalid username or password" error
- Check that users table exists in Supabase
- Verify environment variables are set in Vercel
- Ensure SQL script was run successfully

### Session not persisting
- Check browser console for localStorage errors
- Verify cookies/localStorage not blocked
- Try clearing browser cache

### Can't login after deployment
- Verify Supabase environment variables in Vercel
- Check Vercel logs for API errors
- Ensure users table has data

## Production Deployment

Before deploying to production:

1. ✅ Change all default passwords
2. ✅ Add proper RLS policies in Supabase
3. ✅ Use HTTPS (Vercel does this automatically)
4. ✅ Consider adding JWT tokens for better security
5. ✅ Add rate limiting on login endpoint
6. ✅ Enable 2FA if needed

## API Endpoints

### POST /api/auth/login
Login with username and password

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "admin"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid username or password"
}
```

## Future Enhancements

Consider adding:
- Password reset functionality
- Remember me checkbox
- Failed login attempt tracking
- Session timeout
- JWT tokens instead of localStorage
- User roles and permissions
- Account registration page
