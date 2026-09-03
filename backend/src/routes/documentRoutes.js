const express = require('express');

const router = express.Router();

const { upload } = require('../config/multerConfig');

const { requireAuth } = require('../middleware/authMiddleware');

const { requireRole } = require('../middleware/roleMiddleware');

const {
  requireDocumentAccess
} = require('../middleware/ownershipMiddleware');

const {
  uploadDocument,
  editDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
  checkoutDocument,
  cancelCheckout
} = require('../controllers/documentController');

const {
  listVersions,
  downloadVersion,
  restoreVersion,
  compareVersions,
  publishVersion
} = require('../controllers/versionController');

const {
  shareDocument,
  listDocumentShares
} = require('../controllers/shareController');

const {
  reviewDocument,
  listDocumentReviews
} = require('../controllers/reviewController');


// ============================================================
// OWNER / ADMIN ACCESS
// ============================================================

// Only the document owner or an admin can perform
// owner-level operations such as edit, delete,
// restore, checkout and sharing.
function requireOwnerOrAdmin(req, res, next) {
  const access = req.documentAccess;

  if (
    !access ||
    (!access.isOwner && !access.isAdmin)
  ) {
    return res.status(403).json({
      success: false,
      message:
        'Only the document owner or an admin can do this'
    });
  }

  next();
}


// ============================================================
// DOCUMENTS
// ============================================================

// Upload a new document
// Allowed: admin, engineer
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'engineer'),
  upload.single('file'),
  uploadDocument
);


// List documents
// Access filtering is handled by the controller/access layer.
router.get(
  '/',
  requireAuth,
  listDocuments
);


// Get document details
router.get(
  '/:id',
  requireAuth,
  requireDocumentAccess('view'),
  getDocument
);


// Download current document
router.get(
  '/:id/download',
  requireAuth,
  requireDocumentAccess('download'),
  downloadDocument
);


// ============================================================
// CHECK-OUT / DOCUMENT LOCKING
// ============================================================

// Check out document
//
// Only an admin or engineer can check out.
// Only owner/admin can perform the operation.
router.post(
  '/:id/checkout',
  requireAuth,
  requireRole('admin', 'engineer'),
  requireDocumentAccess('view'),
  checkoutDocument
);


// Cancel checkout
//
// Owner can cancel their own checkout.
// Admin can force-cancel another user's checkout.
router.post(
  '/:id/cancel-checkout',
  requireAuth,
  requireRole('admin', 'engineer'),
  requireDocumentAccess('view'),
  cancelCheckout
);


// ============================================================
// EDIT / DELETE
// ============================================================

// Create a new document version
//
// Backend editDocument() additionally verifies
// that the document is checked out by the current user.
router.post(
  '/:id/edit',
  requireAuth,
  requireRole('admin', 'engineer'),
  requireDocumentAccess('view'),
  upload.single('file'),
  editDocument
);


// Soft-delete document
router.delete(
  '/:id',
  requireAuth,
  requireDocumentAccess('view'),
  requireOwnerOrAdmin,
  deleteDocument
);


// ============================================================
// VERSIONS
// ============================================================

// List all versions
router.get(
  '/:id/versions',
  requireAuth,
  requireDocumentAccess('view'),
  listVersions
);


// Compare two versions
router.get(
  '/:id/versions/compare',
  requireAuth,
  requireDocumentAccess('view'),
  compareVersions
);


// Download a specific version
router.get(
  '/:id/versions/:versionId/download',
  requireAuth,
  requireDocumentAccess('download'),
  downloadVersion
);


// Restore a previous version
//
// Allowed: admin, engineer
// Owner/admin restriction is also enforced.
router.post(
  '/:id/versions/:versionId/restore',
  requireAuth,
  requireRole('admin', 'engineer'),
  requireDocumentAccess('view'),
  requireOwnerOrAdmin,
  restoreVersion
);


// ============================================================
// PUBLISHING
// ============================================================

// Publish an approved version.
//
// Publishing is an administrative operation.
// Only admin can publish.
router.post(
  '/:id/versions/:versionId/publish',
  requireAuth,
  requireRole('admin'),
  requireDocumentAccess('view'),
  requireOwnerOrAdmin,
  publishVersion
);


// ============================================================
// SHARING
// ============================================================

// Share document
//
// Only owner/admin can share.
router.post(
  '/:id/share',
  requireAuth,
  requireDocumentAccess('view'),
  requireOwnerOrAdmin,
  shareDocument
);


// List document shares
//
// Only owner/admin can view/manage shares.
router.get(
  '/:id/shares',
  requireAuth,
  requireDocumentAccess('view'),
  requireOwnerOrAdmin,
  listDocumentShares
);


// ============================================================
// REVIEWS
// ============================================================

// Review a SPECIFIC document version.
//
// Example:
// POST /api/documents/2/versions/5/review
//
// Allowed: admin, reviewer
router.post(
  '/:id/versions/:versionId/review',
  requireAuth,
  requireRole('admin', 'reviewer'),
  reviewDocument
);


// Review history for a document
router.get(
  '/:id/reviews',
  requireAuth,
  requireDocumentAccess('view'),
  listDocumentReviews
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;