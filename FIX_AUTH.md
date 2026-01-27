# Fix Authentication Issue

## Quick Fix Steps

### Step 1: Generate Fresh Password Hash

Run this command in your project directory:

```bash
node generate-hash.js
```

This will output SQL commands like:
```sql
UPDATE users SET password_hash = '$2a$10$...' WHERE username = 'admin';
```

### Step 2: Update Supabase

1. Copy the SQL output from Step 1
2. Go to Supabase → SQL Editor
3. Paste and run the SQL commands
4. Verify with: `SELECT username, password_hash FROM users;`

### Step 3: Test Login

1. Restart your dev server: `npm run dev`
2. Try logging in with:
   - Username: `admin`
   - Password: `password123`
3. Check the terminal/console for debug logs

## Alternative: Use API to Generate Hash

1. Start your dev server: `npm run dev`
2. Open your browser console (F12)
3. Run this JavaScript:

```javascript
fetch('/api/auth/hash-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'password123' })
})
.then(r => r.json())
.then(data => console.log('Hash:', data.hash));
```

4. Copy the hash from console
5. Update Supabase:
```sql
UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';
```

## Debug Checklist

If login still fails, check these:

### ✅ 1. Verify Users Table Exists
```sql
SELECT * FROM users LIMIT 5;
```

If this fails, run `users-schema.sql` first.

### ✅ 2. Check Password Hash Format
```sql
SELECT username, LEFT(password_hash, 7) as hash_prefix FROM users;
```

Should show: `$2a$10$` or `$2b$10$`

### ✅ 3. Check Supabase Environment Variables

In Vercel (or locally in `.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL` - Should be set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Should be set

Restart server after changing env vars!

### ✅ 4. Check Browser Console

Look for errors in browser console (F12 → Console tab)

### ✅ 5. Check Server Logs

Look at your terminal where `npm run dev` is running.

You should see logs like:
```
Login attempt: { username: 'admin', passwordLength: 11 }
User lookup: { found: true, error: null }
User found: { username: 'admin', hasHash: true }
Password comparison: { isValid: true }
```

## Common Issues

### Issue: "User not found"
**Fix:** User doesn't exist in database. Run `users-schema.sql` in Supabase.

### Issue: "Supabase error"
**Fix:**
- Check environment variables
- Verify Supabase connection
- Check if RLS policies are blocking access

### Issue: "Password comparison: { isValid: false }"
**Fix:** Password hash doesn't match. Generate fresh hash (see Step 1 above).

### Issue: No console logs appearing
**Fix:**
- Restart dev server
- Check if API route is being called
- Verify network tab in browser (F12 → Network)

## Manual Verification

Test if bcrypt is working:

Create a test file `test-bcrypt.js`:
```javascript
const bcrypt = require('bcryptjs');

const password = 'password123';
const hash = '$2a$10$...'; // Paste your hash from database

bcrypt.compare(password, hash, (err, result) => {
  console.log('Match:', result); // Should be true
});
```

Run: `node test-bcrypt.js`

## Still Not Working?

If none of the above works, try this simple test login:

1. Temporarily update `pages/api/auth/login.ts`:

```typescript
// Add this at the top of the try block for testing:
if (username === 'test' && password === 'test') {
  return res.status(200).json({
    success: true,
    user: { id: 'test-id', username: 'test' }
  });
}
```

2. Try login with `test` / `test`
3. If this works, the issue is with Supabase or bcrypt
4. If this doesn't work, the issue is with the login form or API call

## Contact Support

If still failing, share these logs:
1. Browser console output (F12 → Console)
2. Server terminal output
3. Supabase SQL query result: `SELECT * FROM users LIMIT 1;`
4. Network tab showing `/api/auth/login` request/response
