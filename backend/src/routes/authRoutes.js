const express = require('express');

const router = express.Router();

const {
  requireAuth
} = require('../middleware/authMiddleware');

const {
  authLimiter
} = require('../middleware/rateLimiter');

const {
  register,
  login,
  logout,
  getPasswordRecoveryQuestion,
  resetPasswordWithSecurityQuestion
} = require('../controllers/authController');


// ============================================================
// PUBLIC AUTHENTICATION
// ============================================================

// Register a new account.
//
// Public users are automatically assigned the "viewer" role.
// Rate limiting protects against registration abuse.
router.post(
  '/register',
  authLimiter,
  register
);


// Login.
//
// Rate limiting protects against brute-force attacks.
router.post(
  '/login',
  authLimiter,
  login
);

// Password recovery: the user must prove knowledge of the
// security answer before a new password can be stored.
router.post(
  '/forgot-password/question',
  authLimiter,
  getPasswordRecoveryQuestion
);

router.post(
  '/forgot-password/reset',
  authLimiter,
  resetPasswordWithSecurityQuestion
);


// ============================================================
// AUTHENTICATED AUTHENTICATION
// ============================================================

// Logout.
//
// A valid JWT is required.
router.post(
  '/logout',
  requireAuth,
  logout
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;