const pool = require('../config/database');


// ============================================================
// HELPERS
// ============================================================

function parsePositiveInteger(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}


// ============================================================
// DOCUMENT ACCESS MIDDLEWARE
//
// permission:
//   'view'     -> user must be able to view document
//   'download' -> user must be able to download document
//
// Access rules:
//
// ADMIN
//   Full access to every non-deleted document.
//
// OWNER
//   Full access to their own document.
//
// REVIEWER
//   Can view documents so they can perform reviews.
//   Download access is NOT automatically granted.
//
// SHARED USER
//   Access is determined by document_shares:
//      can_view
//      can_download
//      expires_at
//      revoked
//
// ============================================================

function requireDocumentAccess(permission = 'view') {
  return async (req, res, next) => {
    try {
      // --------------------------------------------------------
      // Validate requested permission
      // --------------------------------------------------------

      if (
        permission !== 'view' &&
        permission !== 'download'
      ) {
        return res.status(500).json({
          success: false,
          message:
            'Invalid document access permission'
        });
      }

      // --------------------------------------------------------
      // Get document ID
      //
      // Normal document routes use req.params.id.
      // Some other routes may use req.params.documentId.
      // --------------------------------------------------------

      const rawDocumentId =
        req.params.id ||
        req.params.documentId;

      const documentId =
        parsePositiveInteger(
          rawDocumentId
        );

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid document ID'
        });
      }

      // --------------------------------------------------------
      // Make sure authentication exists.
      //
      // Normally requireAuth runs before this middleware,
      // but this protects against incorrect middleware ordering.
      // --------------------------------------------------------

      if (
        !req.user ||
        !req.user.userId
      ) {
        return res.status(401).json({
          success: false,
          message:
            'Authentication required'
        });
      }

      const currentUserId =
        Number(req.user.userId);

      if (
        !Number.isInteger(currentUserId) ||
        currentUserId <= 0
      ) {
        return res.status(401).json({
          success: false,
          message:
            'Invalid authenticated user'
        });
      }

      const userRole =
        req.user.role;

      // --------------------------------------------------------
      // Get document.
      // --------------------------------------------------------

      const docResult =
        await pool.query(
          `SELECT
             id,
             title,
             uploaded_by,
             is_deleted,
             status,
             latest_version_id,
             published_version_id,
             checked_out_by,
             checked_out_at,
             created_at,
             updated_at
           FROM documents
           WHERE id = $1`,
          [documentId]
        );

      // --------------------------------------------------------
      // Document not found
      // --------------------------------------------------------

      if (
        docResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Document not found'
        });
      }

      const document =
        docResult.rows[0];

      // --------------------------------------------------------
      // Deleted documents are never accessible.
      // --------------------------------------------------------

      if (
        document.is_deleted
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Document not found'
        });
      }

      // --------------------------------------------------------
      // Determine ownership / role.
      // --------------------------------------------------------

      const isAdmin =
        userRole === 'admin';

      const isOwner =
        Number(document.uploaded_by) ===
        currentUserId;

      const isReviewer =
        userRole === 'reviewer';

      // --------------------------------------------------------
      // ADMIN
      //
      // Admin has full access regardless of sharing settings.
      // --------------------------------------------------------

      if (isAdmin) {
        req.documentAccess = {
          isOwner,
          isAdmin: true,
          isReviewer: false,
          accessType: 'admin',
          share: null,
          document
        };

        return next();
      }
// --------------------------------------------------------
// VIEWER
//
// Viewers can access published documents only.
// They can view and download published documents.
// They cannot checkout, edit, restore, etc.
// --------------------------------------------------------

const isViewer =
  userRole === 'viewer';

if (isViewer) {

  if (!document.published_version_id) {
    return res.status(403).json({
      success: false,
      message:
        'Viewers can access published documents only'
    });
  }

  req.documentAccess = {
    isOwner: false,
    isAdmin: false,
    isReviewer: false,
    accessType: 'viewer',
    share: null,
    document
  };

  return next();
}
// --------------------------------------------------------
// ENGINEER
//
// Engineers can view any non-deleted document.
// Engineers can download the published version.
// Checkout/edit permissions are enforced separately.
// --------------------------------------------------------

const isEngineer =
  userRole === 'engineer';

if (isEngineer) {

  if (permission === 'download') {

    if (!document.latest_version_id) {
  return res.status(409).json({
    success: false,
    message:
      'This document does not have a current version yet'
  });
}
    

    req.documentAccess = {
      isOwner,
      isAdmin: false,
      isReviewer: false,
      accessType: 'engineer',
      share: null,
      document
    };

    return next();
  }

  req.documentAccess = {
    isOwner,
    isAdmin: false,
    isReviewer: false,
    accessType: 'engineer',
    share: null,
    document
  };

  return next();
}
      // --------------------------------------------------------
      // OWNER
      //
      // Owner has full access to their document.
      // --------------------------------------------------------

      if (isOwner) {
        req.documentAccess = {
          isOwner: true,
          isAdmin: false,
          isReviewer: false,
          accessType: 'owner',
          share: null,
          document
        };

        return next();
      }

      // --------------------------------------------------------
      // REVIEWER
      //
      // Reviewer needs access to documents involved in the
      // review workflow.
      //
      // Reviewers can VIEW the document.
      //
      // They do NOT automatically receive download permission.
      // --------------------------------------------------------

      if (isReviewer) {
        if (
          permission === 'download'
        ) {
          return res.status(403).json({
            success: false,
            message:
              'Reviewers do not have automatic download access to this document'
          });
        }

        req.documentAccess = {
          isOwner: false,
          isAdmin: false,
          isReviewer: true,
          accessType: 'reviewer',
          share: null,
          document
        };

        return next();
      }

      // --------------------------------------------------------
      // SHARED ACCESS
      //
      // Everyone who is not:
      //   admin
      //   owner
      //   reviewer
      //
      // must have an active document share.
      // --------------------------------------------------------

      const permissionColumn =
        permission === 'download'
          ? 'can_download'
          : 'can_view';

      const shareResult =
        await pool.query(
          `SELECT
             s.*
           FROM document_shares s
           WHERE s.document_id = $1
             AND s.shared_with = $2
             AND s.revoked = FALSE
             AND s.${permissionColumn} = TRUE
             AND (
               s.expires_at IS NULL
               OR s.expires_at > NOW()
             )
           ORDER BY
             s.created_at DESC
           LIMIT 1`,
          [
            documentId,
            currentUserId
          ]
        );

      // --------------------------------------------------------
      // No valid share.
      // --------------------------------------------------------

      if (
        shareResult.rows.length === 0
      ) {
        return res.status(403).json({
          success: false,
          message:
            permission === 'download'
              ? 'You do not have download access to this document'
              : 'You do not have access to this document'
        });
      }

      const share =
        shareResult.rows[0];

      // --------------------------------------------------------
      // Successful shared access.
      // --------------------------------------------------------

      req.documentAccess = {
        isOwner: false,
        isAdmin: false,
        isReviewer: false,
        accessType: 'shared',
        share,
        document
      };

      return next();

    } catch (err) {
      console.error(
        '[ERROR] requireDocumentAccess:',
        err.message
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to verify document access'
      });
    }
  };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  requireDocumentAccess
};