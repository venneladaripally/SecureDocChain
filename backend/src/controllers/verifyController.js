const fs = require('fs');
const pool = require('../config/database');
const { sha256File } = require('../utils/hashUtils');
const { logAction } = require('../utils/auditLogger');

// POST /api/verify  (multipart 'file', optional body: documentId, versionId)
async function verifyDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded for verification' });
    }

    const { documentId, versionId } = req.body;
    const uploadedHash = await sha256File(req.file.path);

    let matchedVersion = null;
    let matchedDocument = null;

    if (documentId) {
      // Verify against a specific document (and optionally a specific version;
      // defaults to that document's current version).
      const versionQuery = versionId
        ? `SELECT * FROM document_versions WHERE id = $1 AND document_id = $2`
        : `SELECT * FROM document_versions WHERE document_id = $1 AND is_current = TRUE`;
      const versionParams = versionId ? [versionId, documentId] : [documentId];

      const versionResult = await pool.query(versionQuery, versionParams);
      if (versionResult.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: 'Document/version not found' });
      }
      matchedVersion = versionResult.rows[0];

      const docResult = await pool.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);
      matchedDocument = docResult.rows[0];
    } else {
      // No document specified - search every stored version for a matching hash.
      const searchResult = await pool.query(
        `SELECT * FROM document_versions WHERE sha256_hash = $1 LIMIT 1`,
        [uploadedHash]
      );
      if (searchResult.rows.length > 0) {
        matchedVersion = searchResult.rows[0];
        const docResult = await pool.query(`SELECT * FROM documents WHERE id = $1`, [matchedVersion.document_id]);
        matchedDocument = docResult.rows[0];
      }
    }

    const isAuthentic = matchedVersion ? matchedVersion.sha256_hash === uploadedHash : false;
    const result = matchedVersion ? (isAuthentic ? 'authentic' : 'tampered') : 'unknown';

    let blockchainInfo = null;
    if (matchedVersion) {
      const blockResult = await pool.query(
        `SELECT * FROM blockchain_transactions WHERE version_id = $1`,
        [matchedVersion.id]
      );
      blockchainInfo = blockResult.rows[0] || null;
    }

    await logAction({
      userId: req.user.userId, action: 'VERIFY', entityType: 'document', entityId: matchedDocument ? matchedDocument.id : null,
      details: {
        uploadedHash,
        result,
        matchedVersionNumber: matchedVersion ? matchedVersion.version_number : null
      },
      req
    });

    // Clean up the temp verification upload - we only ever needed its hash.
    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      result,
      uploadedHash,
      document: matchedDocument ? { id: matchedDocument.id, title: matchedDocument.title } : null,
      version: matchedVersion ? {
        id: matchedVersion.id,
        version_number: matchedVersion.version_number,
        sha256_hash: matchedVersion.sha256_hash,
        created_at: matchedVersion.created_at
      } : null,
      blockchain: blockchainInfo
    });
  } catch (err) {
    console.error('[ERROR] verifyDocument:', err.message);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
}

module.exports = { verifyDocument };