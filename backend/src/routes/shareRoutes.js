const express = require('express');

const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');

const {
  revokeShare,
  sharedWithMe
} = require('../controllers/shareController');


// ============================================================
// SHARING
// ============================================================

// Revoke a document share.
//
// Allowed:
// - The user who created the share
// - Admin
//
// POST /api/shares/:shareId/revoke
router.post(
  '/:shareId/revoke',
  requireAuth,
  revokeShare
);


// Get documents shared with the currently
// authenticated user.
//
// Only active, non-expired, non-revoked shares
// are returned.
//
// GET /api/shares/shared-with-me
router.get(
  '/shared-with-me',
  requireAuth,
  sharedWithMe
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;