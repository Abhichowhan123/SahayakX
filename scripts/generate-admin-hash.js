#!/usr/bin/env node
/**
 * ServeEase — Admin password hash generator
 * Usage:
 *   node scripts/generate-admin-hash.js              # prompts for password
 *   node scripts/generate-admin-hash.js mypassword   # hashes inline
 */

const readline = require('readline');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch {
  console.error('bcryptjs not found. Run: npm install bcryptjs');
  process.exit(1);
}

const hashPassword = async (password) => {
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  console.log('\n─────────────────────────────────────────────');
  console.log('Admin password hash generated:');
  console.log(hash);
  console.log('─────────────────────────────────────────────');
  console.log('\nAdd this to services/admin-service/.env:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('─────────────────────────────────────────────\n');
};

const password = process.argv[2];

if (password) {
  hashPassword(password);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter admin password to hash: ', (input) => {
    rl.close();
    hashPassword(input.trim());
  });
}
