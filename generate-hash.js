// Run this script to generate password hashes
// Usage: node generate-hash.js

const bcrypt = require('bcryptjs');

const password = 'password123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }

  console.log('\n=== Password Hash Generated ===\n');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\n=== SQL to update Supabase ===\n');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`);
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'user1';`);
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'demo';`);
  console.log('\n');
});
