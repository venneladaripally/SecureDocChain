const jwt = require('jsonwebtoken');

require('dotenv').config();


// ============================================================
// JWT CONFIGURATION
// ============================================================

const JWT_SECRET =
  process.env.JWT_SECRET;

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '1d';


// ============================================================
// VALIDATE JWT SECRET
// ============================================================

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not configured in environment variables'
  );
}


// ============================================================
// GENERATE TOKEN
//
// Payload:
//
// {
//   userId,
//   username,
//   role
// }
//
// The role is taken from the authenticated database user
// when the token is created.
// ============================================================

function generateToken(user) {
  if (!user) {
    throw new Error(
      'User information is required to generate token'
    );
  }

  const userId =
    Number(user.id);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw new Error(
      'Invalid user ID'
    );
  }

  if (
    !user.username ||
    typeof user.username !== 'string'
  ) {
    throw new Error(
      'Invalid username'
    );
  }

  if (
    !user.role_name ||
    typeof user.role_name !== 'string'
  ) {
    throw new Error(
      'Invalid user role'
    );
  }

  return jwt.sign(
    {
      userId,
      username:
        user.username,
      role:
        user.role_name
    },

    JWT_SECRET,

    {
      expiresIn:
        JWT_EXPIRES_IN
    }
  );
}


// ============================================================
// VERIFY TOKEN
//
// Verifies:
// - Signature
// - Expiration
// - Token structure
//
// Throws an error when the token is invalid or expired.
// requireAuth() is responsible for converting that error
// into a 401 response.
// ============================================================

function verifyToken(token) {
  if (
    !token ||
    typeof token !== 'string'
  ) {
    throw new Error(
      'Authentication token is required'
    );
  }

  const decoded =
    jwt.verify(
      token,
      JWT_SECRET
    );

  if (
    !decoded ||
    decoded.userId === undefined ||
    decoded.username === undefined ||
    decoded.role === undefined
  ) {
    throw new Error(
      'Invalid token payload'
    );
  }

  return decoded;
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateToken,
  verifyToken
};