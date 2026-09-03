const pool = require('../config/database');
const { logAction } = require('../utils/auditLogger');


// ============================================================
// GET /api/reviews/pending
//
// Returns documents whose CURRENT version is waiting for review.
// ============================================================

async function listPendingReviews(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         d.*,
         u.username AS uploaded_by_username,

         v.id AS version_id,
         v.version_number,
         v.version_status,
         v.sha256_hash,
         v.change_summary,
         v.file_name,
         v.created_at AS version_created_at

       FROM documents d

       JOIN users u
         ON d.uploaded_by = u.id

       JOIN document_versions v
         ON v.document_id = d.id
        AND v.is_current = TRUE

       WHERE d.status = 'pending_review'
         AND d.is_deleted = FALSE
         AND v.version_status = 'in_review'

       ORDER BY d.updated_at DESC`
    );

    return res.json({
      success: true,
      documents: result.rows
    });

  } catch (err) {
    console.error(
      '[ERROR] listPendingReviews:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch pending reviews'
    });
  }
}


// ============================================================
// POST /api/documents/:id/versions/:versionId/review
//
// Body:
//
// {
//   "status": "approved" | "rejected",
//   "comments": "optional comments"
// }
//
// Reviews ONE SPECIFIC VERSION.
//
// Rules:
//
// 1. Document must exist.
// 2. Version must belong to that document.
// 3. Version must be the current version.
// 4. Version must be in_review.
// 5. Review is recorded.
// 6. Version status becomes approved/rejected.
// 7. Document status becomes approved/rejected.
// 8. Audit log is created.
// ============================================================

async function reviewDocument(req, res) {
  const client = await pool.connect();

  try {
    const {
      id,
      versionId
    } = req.params;

    const {
      status,
      comments
    } = req.body;

    const reviewerId =
      req.user.userId;

    // ----------------------------------------------------------
    // Validate review decision
    // ----------------------------------------------------------

    if (
      !['approved', 'rejected']
        .includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'status must be "approved" or "rejected"'
      });
    }

    // ----------------------------------------------------------
    // Validate IDs
    // ----------------------------------------------------------

    const documentId =
      Number(id);

    const requestedVersionId =
      Number(versionId);

    if (
      !Number.isInteger(documentId) ||
      !Number.isInteger(requestedVersionId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid document or version ID'
      });
    }

    // ----------------------------------------------------------
    // Start transaction
    // ----------------------------------------------------------

    await client.query(
      'BEGIN'
    );

    // ----------------------------------------------------------
    // Get EXACT requested version
    //
    // FOR UPDATE prevents concurrent review/update
    // operations from modifying the same version.
    // ----------------------------------------------------------

    const versionResult =
      await client.query(
        `SELECT
           v.*,

           d.title,
           d.status AS document_status,
           d.uploaded_by,
           d.is_deleted

         FROM document_versions v

         JOIN documents d
           ON d.id = v.document_id

         WHERE v.id = $1
           AND v.document_id = $2
           AND d.is_deleted = FALSE

         FOR UPDATE`,
        [
          requestedVersionId,
          documentId
        ]
      );

    // ----------------------------------------------------------
    // Version does not exist
    // ----------------------------------------------------------

    if (
      versionResult.rows.length === 0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        success: false,
        message:
          'Document version not found'
      });
    }

    const version =
      versionResult.rows[0];

    // ----------------------------------------------------------
    // Make sure this is the CURRENT version
    // ----------------------------------------------------------

    if (!version.is_current) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        success: false,
        message:
          `Version ${version.version_number} is not the current version`
      });
    }

    // ----------------------------------------------------------
    // Only IN_REVIEW versions can be reviewed
    // ----------------------------------------------------------

    if (
      version.version_status !==
      'in_review'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        success: false,
        message:
          `Version ${version.version_number} is not currently in review`,
        versionStatus:
          version.version_status
      });
    }

    // ----------------------------------------------------------
    // Prevent duplicate review
    //
    // The status check above normally handles this because
    // the version changes from in_review after review.
    // This extra check makes the rule explicit.
    // ----------------------------------------------------------

    const existingReviewResult =
      await client.query(
        `SELECT id
         FROM reviews
         WHERE version_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          requestedVersionId
        ]
      );

    if (
      existingReviewResult.rows.length > 0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        success: false,
        message:
          `Version ${version.version_number} has already been reviewed`
      });
    }

    // ----------------------------------------------------------
    // Record review
    // ----------------------------------------------------------

    const reviewResult =
      await client.query(
        `INSERT INTO reviews (
           document_id,
           version_id,
           reviewer_id,
           status,
           comments,
           reviewed_at
         )

         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           NOW()
         )

         RETURNING *`,
        [
          documentId,
          requestedVersionId,
          reviewerId,
          status,
          comments
            ? comments.trim()
            : null
        ]
      );

    // ----------------------------------------------------------
    // Update version status
    //
    // in_review
    //     ↓
    // approved / rejected
    // ----------------------------------------------------------

    const updatedVersionResult =
      await client.query(
        `UPDATE document_versions

         SET version_status = $1

         WHERE id = $2

         RETURNING *`,
        [
          status,
          requestedVersionId
        ]
      );

    // ----------------------------------------------------------
    // Update document status
    //
    // Because this is the current version, the document status
    // must follow the review result.
    // ----------------------------------------------------------

    const updatedDocumentResult =
      await client.query(
        `UPDATE documents

         SET status = $1,
             updated_at = NOW()

         WHERE id = $2
           AND is_deleted = FALSE

         RETURNING *`,
        [
          status,
          documentId
        ]
      );

    // ----------------------------------------------------------
    // Make sure document update succeeded
    // ----------------------------------------------------------

    if (
      updatedDocumentResult.rows.length === 0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        success: false,
        message:
          'Document could not be updated'
      });
    }

    // ----------------------------------------------------------
    // Commit transaction
    // ----------------------------------------------------------

    await client.query(
      'COMMIT'
    );

    // ----------------------------------------------------------
    // Audit log
    //
    // Audit logging happens AFTER the database transaction
    // succeeds so the review itself is not rolled back if
    // logging encounters a problem.
    // ----------------------------------------------------------

    await logAction({
      userId: reviewerId,

      action:
        status === 'approved'
          ? 'VERSION_APPROVED'
          : 'VERSION_REJECTED',

      entityType:
        'document_version',

      entityId:
        requestedVersionId,

      details: {
        documentId,
        versionNumber:
          version.version_number,

        status,

        comments:
          comments
            ? comments.trim()
            : null,

        sha256Hash:
          version.sha256_hash
      },

      req
    });

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    return res.json({
      success: true,

      message:
        `Version ${version.version_number} ${status}`,

      review:
        reviewResult.rows[0],

      version:
        updatedVersionResult.rows[0],

      document:
        updatedDocumentResult.rows[0]
    });

  } catch (err) {

    // ----------------------------------------------------------
    // Rollback transaction
    // ----------------------------------------------------------

    try {
      await client.query(
        'ROLLBACK'
      );
    } catch (rollbackError) {
      console.error(
        '[ERROR] Rollback failed:',
        rollbackError.message
      );
    }

    console.error(
      '[ERROR] reviewDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to submit review'
    });

  } finally {

    client.release();

  }
}


// ============================================================
// GET /api/documents/:id/reviews
//
// Returns complete review history for a document.
// ============================================================

async function listDocumentReviews(req, res) {
  try {
    const {
      id
    } = req.params;

    const documentId =
      Number(id);

    if (
      !Number.isInteger(documentId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid document ID'
      });
    }

    const result =
      await pool.query(
        `SELECT
           r.*,

           v.version_number,
           v.version_status,
           v.sha256_hash,

           u.username AS reviewer_username

         FROM reviews r

         JOIN document_versions v
           ON r.version_id = v.id

         JOIN users u
           ON r.reviewer_id = u.id

         WHERE r.document_id = $1

         ORDER BY
           r.created_at DESC`,
        [
          documentId
        ]
      );

    return res.json({
      success: true,
      reviews: result.rows
    });

  } catch (err) {

    console.error(
      '[ERROR] listDocumentReviews:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch review history'
    });
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  listPendingReviews,
  reviewDocument,
  listDocumentReviews
};