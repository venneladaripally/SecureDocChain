const pool = require('../config/database');
const { logAction } = require('../utils/auditLogger');


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
// POST /api/documents/:id/share
//
// Body:
//
// {
//   "username": "john",
//   "canView": true,
//   "canDownload": true,
//   "expiresAt": "2026-12-31T23:59:59Z"
// }
//
// Creates a document share.
// ============================================================

async function shareDocument(req, res) {
  try {
    const documentId =
      parsePositiveInteger(req.params.id);

    const {
      username,
      canView = true,
      canDownload = true,
      expiresAt
    } = req.body;

    const sharedBy =
      req.user.userId;

    // ----------------------------------------------------------
    // Validate document ID
    // ----------------------------------------------------------

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID'
      });
    }

    // ----------------------------------------------------------
    // Validate username
    // ----------------------------------------------------------

    if (
      !username ||
      typeof username !== 'string' ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Recipient username is required'
      });
    }

    const cleanUsername =
      username.trim();

    // ----------------------------------------------------------
    // Validate permission values
    // ----------------------------------------------------------

    if (
      typeof canView !== 'boolean' ||
      typeof canDownload !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'canView and canDownload must be boolean values'
      });
    }

    // ----------------------------------------------------------
    // Download permission requires view permission.
    // ----------------------------------------------------------

    if (
      canDownload &&
      !canView
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Download permission requires view permission'
      });
    }

    // ----------------------------------------------------------
    // Validate expiry date.
    // ----------------------------------------------------------

    let parsedExpiresAt = null;

    if (expiresAt) {
      const expiryDate =
        new Date(expiresAt);

      if (
        Number.isNaN(
          expiryDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid expiry date'
        });
      }

      if (
        expiryDate <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Expiry date must be in the future'
        });
      }

      parsedExpiresAt =
        expiryDate.toISOString();
    }

    // ----------------------------------------------------------
    // Verify document exists and isn't deleted.
    // ----------------------------------------------------------

    const documentResult =
      await pool.query(
        `SELECT
           id,
           title,
           uploaded_by,
           is_deleted
         FROM documents
         WHERE id = $1`,
        [documentId]
      );

    if (
      documentResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Document not found'
      });
    }

    const document =
      documentResult.rows[0];

    if (document.is_deleted) {
      return res.status(404).json({
        success: false,
        message:
          'Cannot share a deleted document'
      });
    }

    // ----------------------------------------------------------
    // Find recipient.
    // ----------------------------------------------------------

    const userResult =
      await pool.query(
        `SELECT
           id,
           username
         FROM users
         WHERE username = $1`,
        [cleanUsername]
      );

    if (
      userResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }

    const recipient =
      userResult.rows[0];

    const sharedWithId =
      Number(recipient.id);

    // ----------------------------------------------------------
    // Prevent self-sharing.
    // ----------------------------------------------------------

    if (
      sharedWithId ===
      Number(sharedBy)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'You cannot share a document with yourself'
      });
    }

    // ----------------------------------------------------------
    // Prevent duplicate ACTIVE share.
    //
    // Expired or revoked shares do not block a new share.
    // ----------------------------------------------------------

    const existingShareResult =
      await pool.query(
        `SELECT
           id
         FROM document_shares
         WHERE document_id = $1
           AND shared_with = $2
           AND revoked = FALSE
           AND (
             expires_at IS NULL
             OR expires_at > NOW()
           )
         LIMIT 1`,
        [
          documentId,
          sharedWithId
        ]
      );

    if (
      existingShareResult.rows.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          'An active share already exists for this user'
      });
    }

    // ----------------------------------------------------------
    // Create share.
    // ----------------------------------------------------------

    const insertResult =
      await pool.query(
        `INSERT INTO document_shares (
           document_id,
           shared_by,
           shared_with,
           can_view,
           can_download,
           expires_at,
           revoked
         )

         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           FALSE
         )

         RETURNING *`,
        [
          documentId,
          sharedBy,
          sharedWithId,
          canView,
          canDownload,
          parsedExpiresAt
        ]
      );

    const share =
      insertResult.rows[0];

    // ----------------------------------------------------------
    // Audit log.
    // ----------------------------------------------------------

    await logAction({
      userId: sharedBy,

      action:
        'SHARE',

      entityType:
        'document',

      entityId:
        documentId,

      details: {
        shareId:
          share.id,

        sharedWith:
          recipient.username,

        canView,

        canDownload,

        expiresAt:
          parsedExpiresAt
      },

      req
    });

    return res.status(201).json({
      success: true,
      message:
        'Document shared successfully',
      share
    });

  } catch (err) {
    console.error(
      '[ERROR] shareDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to share document'
    });
  }
}


// ============================================================
// GET /api/documents/:id/shares
//
// Returns share history for one document.
// ============================================================

async function listDocumentShares(req, res) {
  try {
    const documentId =
      parsePositiveInteger(
        req.params.id
      );

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid document ID'
      });
    }

    // ----------------------------------------------------------
    // Verify document exists.
    // ----------------------------------------------------------

    const documentResult =
      await pool.query(
        `SELECT id
         FROM documents
         WHERE id = $1`,
        [documentId]
      );

    if (
      documentResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Document not found'
      });
    }

    // ----------------------------------------------------------
    // Get shares.
    // ----------------------------------------------------------

    const result =
      await pool.query(
        `SELECT
           s.*,

           sw.username AS shared_with_username,

           sb.username AS shared_by_username

         FROM document_shares s

         JOIN users sw
           ON s.shared_with = sw.id

         JOIN users sb
           ON s.shared_by = sb.id

         WHERE s.document_id = $1

         ORDER BY
           s.created_at DESC`,
        [documentId]
      );

    return res.json({
      success: true,
      shares: result.rows
    });

  } catch (err) {
    console.error(
      '[ERROR] listDocumentShares:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to list shares'
    });
  }
}


// ============================================================
// POST /api/shares/:shareId/revoke
//
// Revokes an existing share.
//
// Allowed:
// - User who created the share
// - Admin
// ============================================================

async function revokeShare(req, res) {
  try {
    const shareId =
      parsePositiveInteger(
        req.params.shareId
      );

    if (!shareId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid share ID'
      });
    }

    // ----------------------------------------------------------
    // Get share.
    // ----------------------------------------------------------

    const shareResult =
      await pool.query(
        `SELECT
           s.*,
           d.is_deleted
         FROM document_shares s
         JOIN documents d
           ON s.document_id = d.id
         WHERE s.id = $1`,
        [shareId]
      );

    if (
      shareResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Share not found'
      });
    }

    const share =
      shareResult.rows[0];

    // ----------------------------------------------------------
    // Permission check.
    // ----------------------------------------------------------

    const isAdmin =
      req.user.role === 'admin';

    const isSharer =
      Number(share.shared_by) ===
      Number(req.user.userId);

    if (
      !isSharer &&
      !isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only the sharer or an admin can revoke this share'
      });
    }

    // ----------------------------------------------------------
    // Already revoked.
    // ----------------------------------------------------------

    if (share.revoked) {
      return res.status(409).json({
        success: false,
        message:
          'Share has already been revoked'
      });
    }

    // ----------------------------------------------------------
    // Revoke share.
    // ----------------------------------------------------------

    const updateResult =
      await pool.query(
        `UPDATE document_shares

         SET revoked = TRUE,
             revoked_at = NOW()

         WHERE id = $1
           AND revoked = FALSE

         RETURNING *`,
        [shareId]
      );

    if (
      updateResult.rows.length === 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Share could not be revoked'
      });
    }

    // ----------------------------------------------------------
    // Audit log.
    // ----------------------------------------------------------

    await logAction({
      userId:
        req.user.userId,

      action:
        'REVOKE_SHARE',

      entityType:
        'document',

      entityId:
        Number(share.document_id),

      details: {
        shareId,

        sharedWith:
          share.shared_with,

        revokedByAdmin:
          isAdmin &&
          !isSharer
      },

      req
    });

    return res.json({
      success: true,
      message:
        'Share revoked successfully',
      share:
        updateResult.rows[0]
    });

  } catch (err) {
    console.error(
      '[ERROR] revokeShare:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to revoke share'
    });
  }
}


// ============================================================
// GET /api/shares/shared-with-me
//
// Returns documents actively shared with current user.
//
// Conditions:
//
// - Share belongs to current user
// - Share isn't revoked
// - Share isn't expired
// - Document isn't deleted
// ============================================================

async function sharedWithMe(req, res) {
  try {
    const userId =
      Number(req.user.userId);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid user ID'
      });
    }

    const result =
      await pool.query(
        `SELECT
           d.*,

           s.id AS share_id,

           s.can_view,
           s.can_download,

           s.expires_at,

           s.created_at AS shared_at,

           sb.username AS shared_by_username

         FROM document_shares s

         JOIN documents d
           ON s.document_id = d.id

         JOIN users sb
           ON s.shared_by = sb.id

         WHERE s.shared_with = $1

           AND s.revoked = FALSE

           AND d.is_deleted = FALSE

           AND (
             s.expires_at IS NULL
             OR s.expires_at > NOW()
           )

         ORDER BY
           s.created_at DESC`,
        [userId]
      );

    return res.json({
      success: true,
      documents: result.rows
    });

  } catch (err) {
    console.error(
      '[ERROR] sharedWithMe:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch shared documents'
    });
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  shareDocument,
  listDocumentShares,
  revokeShare,
  sharedWithMe
};