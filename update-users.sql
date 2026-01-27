-- UPDATE existing users with fresh password hashes
-- All passwords will be set to: password123

-- Method 1: Update existing users (if users table already exists)
UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'admin';
UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'user1';
UPDATE users SET password_hash = '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy' WHERE username = 'demo';

-- Method 2: Delete and re-insert (if updates don't work)
-- DELETE FROM users WHERE username IN ('admin', 'user1', 'demo');
-- INSERT INTO users (username, password_hash) VALUES
--   ('admin', '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy'),
--   ('user1', '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy'),
--   ('demo', '$2a$10$uLc2ZTe4DcquFvWfspWfgehhpA1XaJdKcZCLrMjixvelQ6VrRYpzy');

-- To verify users exist:
-- SELECT username, created_at FROM users;
