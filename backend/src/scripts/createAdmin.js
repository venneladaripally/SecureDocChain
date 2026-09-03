// One-time bootstrap script. Run with: node scripts/createAdmin.js
// Creates (or updates the password of) the single Admin account from
// env vars. This is intentionally the ONLY way an admin account can be
// created — there is no admin self-registration route in the API.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function run() {
  const { ADMIN_FULL_NAME, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('[ERROR] Set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }

  const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
  if (roleResult.rows.length === 0) {
    console.error('[ERROR] "admin" role not found — run database/seed.sql first.');
    process.exit(1);
  }
  const adminRoleId = roleResult.rows[0].id;
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [ADMIN_USERNAME]);

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET password_hash = $1, role_id = $2, is_active = TRUE, updated_at = NOW() WHERE username = $3`,
      [passwordHash, adminRoleId, ADMIN_USERNAME]
    );
    console.log(`[INFO] Admin account "${ADMIN_USERNAME}" already existed — password/role refreshed.`);
  } else {
    await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [ADMIN_FULL_NAME || 'System Administrator', ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, adminRoleId]
    );
    console.log(`[INFO] Admin account "${ADMIN_USERNAME}" created.`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('[ERROR] createAdmin failed:', err.message);
  process.exit(1);
});