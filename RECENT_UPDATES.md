# Recent Updates

## Changes Made

### 1. Rows Per Page Selector
- Added a dropdown to change the number of rows displayed per page
- Options: 10, 15, 20, or 30 rows per page
- Located in the pagination section (bottom of the orders list)
- Default is still 10 rows per page
- Resets to page 1 when changed

### 2. Status Change: "Delivered" → "Picked up"
- Changed all references from "Delivered" to "Picked up" to match Allegro terminology
- Updated in:
  - Status filter dropdown
  - Status badges on order cards
  - Edit order modal
  - Add order modal

### 3. Fixed Authentication
- Generated fresh valid bcrypt hash for password123
- Updated `update-users.sql` with the new valid hash
- **Important:** You need to run the SQL commands in Supabase to fix login

## Fix Authentication (REQUIRED)

To fix the login issue, follow these steps:

1. **Open Supabase SQL Editor:**
   - Go to your Supabase dashboard
   - Click "SQL Editor" in the left sidebar

2. **Run the SQL from update-users.sql:**
   ```sql
   UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'admin';
   UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'user1';
   UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'demo';
   ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

4. **Test login:**
   - Username: `admin`
   - Password: `password123`

Watch the terminal logs. You should now see:
```
Password comparison: { isValid: true }
```

## Next Steps

After running the SQL update in Supabase:
1. Test the login functionality
2. Try changing the rows per page to see different amounts
3. Verify that "Picked up" status appears correctly in filters and badges
4. Deploy to Vercel when ready

## Files Modified
- `src/components/Dashboard.tsx` - Added rows per page selector, changed status terminology
- `update-users.sql` - Updated with valid bcrypt hash
