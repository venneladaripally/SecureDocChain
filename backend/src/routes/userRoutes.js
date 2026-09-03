const express = require('express');

const router = express.Router();

const {
  requireAuth
} = require('../middleware/authMiddleware');

const {
  getCurrentUser,
  setSecurityQuestion,
  changePassword
} = require('../controllers/userController');


// ============================================================
// CURRENT USER
// ============================================================

// GET /api/users/me
//
// Returns the currently authenticated user's profile,
// role and security-question status.
router.get(
  '/me',
  requireAuth,
  getCurrentUser
);


// ============================================================
// SECURITY QUESTION
// ============================================================

// PUT /api/users/me/security-question
//
// Body:
//
// {
//   "securityQuestion": "...",
//   "securityAnswer": "..."
// }
//
// The answer is stored as a bcrypt hash.
router.put(
  '/me/security-question',
  requireAuth,
  setSecurityQuestion
);


// ============================================================
// PASSWORD
// ============================================================

// PUT /api/users/me/password
//
// Body:
//
// {
//   "currentPassword": "...",
//   "securityAnswer": "...",
//   "newPassword": "..."
// }
router.put(
  '/me/password',
  requireAuth,
  changePassword
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;