-- Create the users table in Supabase
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index on username for faster lookups
CREATE INDEX idx_users_username ON users(username);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (you can restrict this later)
CREATE POLICY "Enable all operations for authenticated users" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert some default users (password is 'password123' hashed with bcrypt)
-- Note: You should change these passwords after first login!
INSERT INTO users (username, password_hash) VALUES
  ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('user1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('demo', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- All users have password: password123
-- Please change these after testing!
