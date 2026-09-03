const fs = require('fs');
const pool = require('../config/database');
const { sha256File } = require('../utils/hashUtils');
const { registerOnBlockchain } = require('../utils/blockchainUtils');
const { logAction } = require('../utils/auditLogger');


// ============================================================
// POST /api/documents
// Creates a document + its Version 1
// ============================================================

async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { title, description, category } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const {
      filename,
      path: filePath,
      mimetype,
      size
    } = req.file;

    const uploadedBy = req.user.userId;

    const sha256Hash = await sha256File(filePath);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // --------------------------------------------------------
      // Create document
      // --------------------------------------------------------

      const docResult = await client.query(
        `INSERT INTO documents
          (
            title,
            description,
            category,
            file_name,
            file_path,
            file_size,
            mime_type,
            uploaded_by,
            status
          )
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_review')
         RETURNING *`,
        [
          title,
          description || null,
          category || null,
          filename,
          filePath,
          size,
          mimetype,
          uploadedBy
        ]
      );

      const document = docResult.rows[0];

      // --------------------------------------------------------
      // Create Version 1
      // --------------------------------------------------------

      const versionResult = await client.query(
        `INSERT INTO document_versions
          (
            document_id,
            version_number,
            file_name,
            file_path,
            file_size,
            mime_type,
            sha256_hash,
            change_summary,
            is_current,
            version_status,
            uploaded_by
          )
         VALUES
          ($1, 1, $2, $3, $4, $5, $6, $7, TRUE, 'in_review', $8)
         RETURNING *`,
        [
          document.id,
          filename,
          filePath,
          size,
          mimetype,
          sha256Hash,
          'Initial upload',
          uploadedBy
        ]
      );

      const version = versionResult.rows[0];

      // --------------------------------------------------------
      // Set Version 1 as latest version
      // --------------------------------------------------------

      const updatedDocumentResult = await client.query(
        `UPDATE documents
         SET latest_version_id = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [version.id, document.id]
      );

      const updatedDocument = updatedDocumentResult.rows[0];

      await client.query('COMMIT');

      // --------------------------------------------------------
      // Blockchain registration
      // --------------------------------------------------------

      const block = await registerOnBlockchain({
        documentId: document.id,
        versionId: version.id,
        dataHash: sha256Hash,
        registeredBy: uploadedBy
      });

      // --------------------------------------------------------
      // Audit log
      // --------------------------------------------------------

      await logAction({
        userId: uploadedBy,
        action: 'UPLOAD',
        entityType: 'document',
        entityId: document.id,
        details: {
          title,
          versionNumber: 1,
          sha256Hash,
          blockchainTxId: block.tx_id
        },
        req
      });

      return res.status(201).json({
        success: true,
        document: updatedDocument,
        version,
        blockchain: block
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('[ERROR] uploadDocument:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to upload document'
    });
  }
}


// ============================================================
// POST /api/documents/:id/edit
// Creates a NEW VERSION for an existing document.
//
// IMPORTANT:
// The document must be checked out by the current user.
// ============================================================

async function editDocument(req, res) {
  try {
    const { id } = req.params;
    const { changeSummary } = req.body;
    const uploadedBy = req.user.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const {
      filename,
      path: filePath,
      mimetype,
      size
    } = req.file;

    // --------------------------------------------------------
    // Calculate hash of the new file
    // --------------------------------------------------------

    const sha256Hash = await sha256File(filePath);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ------------------------------------------------------
      // Lock the document row and verify checkout ownership
      // ------------------------------------------------------

      const docResult = await client.query(
  `SELECT
     d.*,
     u.username AS checked_out_by_username
   FROM documents d
   LEFT JOIN users u
     ON d.checked_out_by = u.id
   WHERE d.id = $1
     AND d.is_deleted = FALSE
   FOR UPDATE OF d`,
  [id]
);

      if (docResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      const document = docResult.rows[0];

      // ------------------------------------------------------
      // Document MUST be checked out
      // ------------------------------------------------------

      if (!document.checked_out_by) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          success: false,
          message: 'Document must be checked out before editing'
        });
      }

      // ------------------------------------------------------
      // Only checkout owner can create a new version
      // ------------------------------------------------------

      if (
        Number(document.checked_out_by) !==
        Number(uploadedBy)
      ) {
        await client.query('ROLLBACK');

        return res.status(423).json({
          success: false,
          message: 'Document is locked by another user',
          checkedOutBy: document.checked_out_by,
          checkedOutByUsername:
            document.checked_out_by_username,
          checkedOutAt: document.checked_out_at
        });
      }

      // ------------------------------------------------------
      // Get the latest version
      // ------------------------------------------------------

      const lastVersionResult = await client.query(
        `SELECT *
         FROM document_versions
         WHERE document_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [id]
      );

      if (lastVersionResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          success: false,
          message: 'Document has no existing version'
        });
      }

      const previousVersion =
        lastVersionResult.rows[0];

      const nextVersionNumber =
        previousVersion.version_number + 1;

      // ------------------------------------------------------
      // IMPORTANT VERSION RULE
      //
      // Do NOT supersede the previous published version here.
      //
      // The previous version remains published until a NEW
      // version is actually published.
      //
      // We only remove "current working" status from it.
      // ------------------------------------------------------

      await client.query(
        `UPDATE document_versions
         SET is_current = FALSE
         WHERE document_id = $1`,
        [id]
      );

      // ------------------------------------------------------
      // Create the new version
      // ------------------------------------------------------

      const versionResult = await client.query(
        `INSERT INTO document_versions
          (
            document_id,
            version_number,
            file_name,
            file_path,
            file_size,
            mime_type,
            sha256_hash,
            change_summary,
            is_current,
            version_status,
            uploaded_by
          )
         VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            TRUE,
            'in_review',
            $9
          )
         RETURNING *`,
        [
          id,
          nextVersionNumber,
          filename,
          filePath,
          size,
          mimetype,
          sha256Hash,
          changeSummary || null,
          uploadedBy
        ]
      );

      const version = versionResult.rows[0];

      // ------------------------------------------------------
      // Update document to the NEWEST WORKING version
      // ------------------------------------------------------

      const updatedDocResult = await client.query(
        `UPDATE documents
         SET file_name = $1,
             file_path = $2,
             file_size = $3,
             mime_type = $4,
             latest_version_id = $5,
             status = 'pending_review',

             -- Release checkout after successful version creation
             checked_out_by = NULL,
             checked_out_at = NULL,

             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          filename,
          filePath,
          size,
          mimetype,
          version.id,
          id
        ]
      );

      await client.query('COMMIT');

      // ------------------------------------------------------
      // Register NEW VERSION on blockchain
      // ------------------------------------------------------

      const block = await registerOnBlockchain({
        documentId: Number(id),
        versionId: version.id,
        dataHash: sha256Hash,
        registeredBy: uploadedBy
      });

      // ------------------------------------------------------
      // Audit log
      // --------------------------------------------------------

      await logAction({
        userId: uploadedBy,
        action: 'EDIT',
        entityType: 'document_version',
        entityId: version.id,
        details: {
          documentId: Number(id),
          documentTitle:
            updatedDocResult.rows[0].title,

          previousVersion:
            previousVersion.version_number,

          newVersion:
            nextVersionNumber,

          previousHash:
            previousVersion.sha256_hash,

          newHash:
            sha256Hash,

          changeSummary:
            changeSummary || null,

          blockchainTxId:
            block.tx_id
        },
        req
      });

      return res.status(200).json({
        success: true,

        message:
          `Version ${nextVersionNumber} created successfully and submitted for review`,

        document:
          updatedDocResult.rows[0],

        version,

        blockchain: block
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;

    } finally {
      client.release();
    }

  } catch (err) {

    // ========================================================
    // TEMPORARY DIAGNOSTIC LOGGING
    // ========================================================

    console.error('[ERROR] editDocument:', err);
    console.error('[ERROR] editDocument stack:', err.stack);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}


// ============================================================
// POST /api/documents/:id/checkout
//
// Checks out a document for the current user.
//
// Only ONE user can successfully acquire the lock.
// ============================================================

async function checkoutDocument(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // --------------------------------------------------------
    // Atomic checkout
    // --------------------------------------------------------

    const result = await pool.query(
      `UPDATE documents d
       SET checked_out_by = $1,
           checked_out_at = NOW(),
           updated_at = NOW()
       WHERE d.id = $2
         AND d.is_deleted = FALSE
         AND d.checked_out_by IS NULL
         AND EXISTS (
           SELECT 1
           FROM document_versions v
           WHERE v.id = d.latest_version_id
             AND v.version_status IN ('published', 'approved', 'rejected')
         )
       RETURNING d.*`,
      [userId, id]
    );

    // --------------------------------------------------------
    // Checkout failed
    // --------------------------------------------------------

    if (result.rows.length === 0) {

      const documentResult = await pool.query(
        `SELECT
           d.id,
           d.title,
           d.checked_out_by,
           d.checked_out_at,
           u.username AS checked_out_by_username
         FROM documents d
         LEFT JOIN users u
           ON d.checked_out_by = u.id
         WHERE d.id = $1
           AND d.is_deleted = FALSE`,
        [id]
      );

      // Document doesn't exist
      if (documentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      const document = documentResult.rows[0];

      // Someone else has the lock
      if (document.checked_out_by) {
        return res.status(409).json({
          success: false,
          message: 'Document is already checked out',
          checkedOutBy: document.checked_out_by,
          checkedOutByUsername:
            document.checked_out_by_username,
          checkedOutAt: document.checked_out_at
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Unable to check out document'
      });
    }

    const document = result.rows[0];

    // --------------------------------------------------------
    // Audit log
    // --------------------------------------------------------

    await logAction({
      userId,
      action: 'CHECKOUT',
      entityType: 'document',
      entityId: Number(id),
      details: {
        documentId: Number(id),
        checkedOutAt: document.checked_out_at
      },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Document checked out successfully',
      document
    });

  } catch (err) {
    console.error(
      '[ERROR] checkoutDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to check out document'
    });
  }
}


// ============================================================
// POST /api/documents/:id/cancel-checkout
//
// Releases the edit lock.
//
// The user who owns the lock can release it.
// An admin can also release it.
// ============================================================

async function cancelCheckout(req, res) {
  try {
    const { id } = req.params;

    const userId = req.user.userId;

    const isAdmin =
      req.user.role === 'admin';

    // --------------------------------------------------------
    // Release lock
    // --------------------------------------------------------

    const result = await pool.query(
      `UPDATE documents
       SET checked_out_by = NULL,
           checked_out_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND is_deleted = FALSE
         AND (
           checked_out_by = $2
           OR $3 = TRUE
         )
       RETURNING *`,
      [
        id,
        userId,
        isAdmin
      ]
    );

    // --------------------------------------------------------
    // Nothing was updated
    // --------------------------------------------------------

    if (result.rows.length === 0) {

      const documentResult = await pool.query(
        `SELECT
           id,
           checked_out_by,
           checked_out_at
         FROM documents
         WHERE id = $1
           AND is_deleted = FALSE`,
        [id]
      );

      if (documentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      const document = documentResult.rows[0];

      // Nobody has the lock
      if (!document.checked_out_by) {
        return res.status(409).json({
          success: false,
          message: 'Document is not currently checked out'
        });
      }

      // Another user owns the lock
      return res.status(403).json({
        success: false,
        message:
          'Only the user who checked out the document or an admin can cancel the checkout'
      });
    }

    const document = result.rows[0];

    // --------------------------------------------------------
    // Audit log
    // --------------------------------------------------------

    await logAction({
      userId,
      action: 'CANCEL_CHECKOUT',
      entityType: 'document',
      entityId: Number(id),
      details: {
        documentId: Number(id)
      },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Document checkout cancelled',
      document
    });

  } catch (err) {
    console.error(
      '[ERROR] cancelCheckout:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel checkout'
    });
  }
}


// ============================================================
// GET /api/documents?search=&category=&status=
// ============================================================

async function listDocuments(req, res) {
  try {
    const {
      search,
      category,
      status
    } = req.query;

    const conditions = [
      'd.is_deleted = FALSE'
    ];

    const values = [];

    // --------------------------------------------------------
    // Search filter
    // --------------------------------------------------------

    if (search) {
      values.push(`%${search}%`);

      conditions.push(
        `(d.title ILIKE $${values.length}
          OR d.description ILIKE $${values.length})`
      );
    }

    // --------------------------------------------------------
    // Category filter
    // --------------------------------------------------------

    if (category) {
      values.push(category);

      conditions.push(
        `d.category = $${values.length}`
      );
    }

    // --------------------------------------------------------
    // Status filter
    // --------------------------------------------------------

    if (status) {
      values.push(status);

      conditions.push(
        `d.status = $${values.length}`
      );
    }

    // --------------------------------------------------------
    // ACCESS RULES
    //
    // Admin:
    //   Can see every document.
    //
    // Reviewer:
    //   Can see every document.
    //
    // Owner / Viewer:
    //   Can see owned/shared documents.
    // --------------------------------------------------------

    if (req.user.role === 'viewer') {

  // Viewers can see published documents only.
  conditions.push(
    `d.published_version_id IS NOT NULL`
  );

} else if (
  req.user.role !== 'admin' &&
  req.user.role !== 'reviewer' &&
  req.user.role !== 'engineer'
) {

  // Engineers/other roles keep the existing
  // owner/shared-document access rules.
  values.push(req.user.userId);

  conditions.push(
    `(d.uploaded_by = $${values.length}
      OR d.id IN (
        SELECT document_id
        FROM document_shares
        WHERE shared_with = $${values.length}
          AND revoked = FALSE
          AND (
            expires_at IS NULL
            OR expires_at > NOW()
          )
      ))`
  );
}

    const query = `
      SELECT
        d.*,

        u.username AS uploaded_by_username,

        (
          SELECT COUNT(*)
          FROM document_versions v
          WHERE v.document_id = d.id
        ) AS version_count

      FROM documents d

      JOIN users u
        ON d.uploaded_by = u.id

      WHERE ${conditions.join(' AND ')}

      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(
      query,
      values
    );

    console.log(
      `[DEBUG] listDocuments: ${req.user.username} (${req.user.role}) received ${result.rows.length} documents`
    );

    return res.json({
      success: true,
      documents: result.rows
    });

  } catch (err) {
    console.error(
      '[ERROR] listDocuments:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to list documents'
    });
  }
}


// ============================================================
// GET /api/documents/:id
// ============================================================

async function getDocument(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         d.*,
         u.username AS uploaded_by_username,
         cu.username AS checked_out_by_username
       FROM documents d
       JOIN users u
         ON d.uploaded_by = u.id
       LEFT JOIN users cu
         ON d.checked_out_by = cu.id
       WHERE d.id = $1
         AND d.is_deleted = FALSE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    await logAction({
      userId: req.user.userId,
      action: 'VIEW',
      entityType: 'document',
      entityId: Number(id),
      req
    });

    return res.json({
      success: true,
      document: result.rows[0]
    });

  } catch (err) {
    console.error(
      '[ERROR] getDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch document'
    });
  }
}


// ============================================================
// GET /api/documents/:id/download
// Always downloads the CURRENT version.
// ============================================================

async function downloadDocument(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
  `SELECT
     d.id,
     d.title,
     d.latest_version_id,
     v.file_path,
     v.file_name,
     v.version_number,
     v.version_status
   FROM documents d
   LEFT JOIN document_versions v
     ON v.id = d.latest_version_id
   WHERE d.id = $1
     AND d.is_deleted = FALSE`,
  [id]
);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = result.rows[0];

    // --------------------------------------------------------
    // A document must have a published version before the
    // normal "Download" operation is available.
    // --------------------------------------------------------

    if (!document.latest_version_id) {
  return res.status(409).json({
    success: false,
    message: 'This document does not have a current version yet'
  });
}

    if (!document.file_path) {
      return res.status(404).json({
        success: false,
        message: 'Published version file not found'
      });
    }

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'Published file is missing on server'
      });
    }

    // --------------------------------------------------------
    // Audit download of the published version
    // --------------------------------------------------------

    await logAction({
      userId: req.user.userId,
      action: 'DOWNLOAD',
      entityType: 'document_version',
entityId: document.latest_version_id,      details: {
        documentId: Number(id),
        versionNumber: document.version_number,
        versionStatus: document.version_status
      },
      req
    });

    return res.download(
      document.file_path,
      `v${document.version_number}-${document.file_name}`
    );

  } catch (err) {
    console.error(
      '[ERROR] downloadDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to download document'
    });
  }
}


// ============================================================
// DELETE /api/documents/:id
// Soft delete
// ============================================================

async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE documents
       SET is_deleted = TRUE,
           checked_out_by = NULL,
           checked_out_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await logAction({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'document',
      entityId: Number(id),
      req
    });

    return res.json({
      success: true,
      message: 'Document deleted'
    });

  } catch (err) {
    console.error(
      '[ERROR] deleteDocument:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  uploadDocument,
  editDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
  checkoutDocument,
  cancelCheckout
};