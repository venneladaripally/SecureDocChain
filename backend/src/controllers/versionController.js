const fs = require('fs');
const path = require('path');

const pool = require('../config/database');

const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const sharp = require('sharp');
const pixelmatch = require('pixelmatch');

const { PDFParse } = require('pdf-parse');

const { sha256File } = require('../utils/hashUtils');
const { registerOnBlockchain } = require('../utils/blockchainUtils');
const { logAction } = require('../utils/auditLogger');
const { buildLineDiff } = require('../utils/documentDiff');


// ============================================================
// VERSION CONTROLLER
// ============================================================
//
// Handles:
//
// 1. List document versions
// 2. Download a specific version
// 3. Restore an old version
// 4. Compare two versions
// 5. Publish an approved version
//
// Supported comparison formats:
//
// TXT       -> line-by-line comparison
// DOC       -> extracted text + line-by-line comparison
// DOCX      -> extracted text + line-by-line comparison
// PDF       -> extracted text + line-by-line comparison
// PNG       -> pixel-level comparison
// JPG/JPEG  -> pixel-level comparison
//
// SHA-256 hashes are available for every file type.
//
// ============================================================



// ============================================================
// HELPER: NORMALIZE TEXT
// ============================================================

function normalizeText(text) {
  if (text === null || text === undefined) {
    return '';
  }

  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '');
}



// ============================================================
// HELPER: GET FILE EXTENSION
// ============================================================

function getFileExtension(fileName = '') {
  return path.extname(fileName).toLowerCase();
}



// ============================================================
// HELPER: DETERMINE COMPARISON TYPE
// ============================================================
//
// MIME type alone cannot always be trusted.
// Therefore both MIME type and file extension are checked.
//
// ============================================================

function getComparisonType(version) {
  const extension =
    getFileExtension(version.file_name);

  const mimeType =
    String(version.mime_type || '').toLowerCase();


  // ----------------------------------------------------------
  // TXT
  // ----------------------------------------------------------

  if (
    extension === '.txt' ||
    mimeType === 'text/plain'
  ) {
    return 'text';
  }


  // ----------------------------------------------------------
  // DOCX
  // ----------------------------------------------------------

  if (
    extension === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }


  // ----------------------------------------------------------
  // DOC
  // ----------------------------------------------------------

  if (
    extension === '.doc' ||
    mimeType === 'application/msword'
  ) {
    return 'doc';
  }


  // ----------------------------------------------------------
  // PDF
  // ----------------------------------------------------------

  if (
    extension === '.pdf' ||
    mimeType === 'application/pdf'
  ) {
    return 'pdf';
  }


  // ----------------------------------------------------------
  // PNG
  // ----------------------------------------------------------

  if (
    extension === '.png' ||
    mimeType === 'image/png'
  ) {
    return 'image';
  }


  // ----------------------------------------------------------
  // JPG / JPEG
  // ----------------------------------------------------------

  if (
    extension === '.jpg' ||
    extension === '.jpeg' ||
    mimeType === 'image/jpeg'
  ) {
    return 'image';
  }


  // ----------------------------------------------------------
  // UNKNOWN
  // ----------------------------------------------------------

  return 'unknown';
}



// ============================================================
// HELPER: CHECK FILE
// ============================================================

function validateVersionFile(filePath) {
  if (!filePath) {
    return false;
  }

  return fs.existsSync(filePath);
}



// ============================================================
// TEXT EXTRACTION: TXT
// ============================================================

async function extractTextFile(filePath) {
  const text =
    fs.readFileSync(
      filePath,
      'utf8'
    );

  return normalizeText(text);
}



// ============================================================
// TEXT EXTRACTION: DOCX
// ============================================================
//
// Mammoth extracts readable document text from DOCX.
//
// Formatting changes such as font size/color are not treated as
// textual changes here. The comparison is based on document text.
//
// ============================================================

async function extractDocxText(filePath) {
  const result =
    await mammoth.extractRawText({
      path: filePath
    });

  return normalizeText(
    result.value
  );
}



// ============================================================
// TEXT EXTRACTION: DOC
// ============================================================
//
// word-extractor supports legacy Microsoft Word .doc files.
//
// ============================================================

async function extractDocText(filePath) {
  const extractor =
    new WordExtractor();

  const document =
    await extractor.extract(filePath);

  return normalizeText(
    document.getBody()
  );
}



// ============================================================
// TEXT EXTRACTION: PDF
// ============================================================
//
// IMPORTANT:
//
// pdf-parse v2 uses PDFParse.
//
// Old:
//
// const pdfParse = require('pdf-parse');
// await pdfParse(buffer);
//
// New:
//
// const { PDFParse } = require('pdf-parse');
// const parser = new PDFParse({ data: buffer });
// const result = await parser.getText();
//
// ============================================================

async function extractPdfText(filePath) {
  const buffer =
    fs.readFileSync(filePath);

  const parser =
    new PDFParse({
      data: buffer
    });

  try {
    const result =
      await parser.getText();

    return normalizeText(
      result.text || ''
    );

  } finally {
    await parser.destroy();
  }
}



// ============================================================
// GENERIC TEXT EXTRACTION
// ============================================================

async function extractComparableText(
  filePath,
  comparisonType
) {
  switch (comparisonType) {

    case 'text':
      return await extractTextFile(
        filePath
      );

    case 'doc':
      return await extractDocText(
        filePath
      );

    case 'docx':
      return await extractDocxText(
        filePath
      );

    case 'pdf':
      return await extractPdfText(
        filePath
      );

    default:
      throw new Error(
        `Unsupported text comparison type: ${comparisonType}`
      );
  }
}



// ============================================================
// IMAGE COMPARISON
// ============================================================
//
// PNG/JPG/JPEG files are not text files.
//
// Therefore line-by-line comparison does not make sense.
//
// Instead:
//
// 1. Normalize both images
// 2. Convert them to RGBA
// 3. Compare every pixel
// 4. Count different pixels
// 5. Calculate percentage difference
//
// ============================================================

async function compareImages(
  filePathA,
  filePathB
) {

  // ----------------------------------------------------------
  // Read image metadata
  // ----------------------------------------------------------

  const metadataA =
    await sharp(filePathA)
      .metadata();

  const metadataB =
    await sharp(filePathB)
      .metadata();


  const widthA =
    metadataA.width;

  const heightA =
    metadataA.height;

  const widthB =
    metadataB.width;

  const heightB =
    metadataB.height;


  // ----------------------------------------------------------
  // Validate dimensions
  // ----------------------------------------------------------

  if (
    !widthA ||
    !heightA ||
    !widthB ||
    !heightB
  ) {
    throw new Error(
      'Unable to determine image dimensions'
    );
  }


  // ----------------------------------------------------------
  // Different dimensions
  // ----------------------------------------------------------

  if (
    widthA !== widthB ||
    heightA !== heightB
  ) {

    return {
      identical: false,

      comparable: false,

      widthA,
      heightA,

      widthB,
      heightB,

      diffPixels: null,

      totalPixels: null,

      differencePercent: null,

      message:
        'Images have different dimensions and cannot be compared pixel-by-pixel.'
    };
  }


  // ----------------------------------------------------------
  // Convert both images to RGBA raw buffers.
  //
  // This makes PNG/JPG/JPEG comparable regardless of their
  // original encoding.
  // ----------------------------------------------------------

  const imageA =
    await sharp(filePathA)
      .ensureAlpha()
      .raw()
      .toBuffer();

  const imageB =
    await sharp(filePathB)
      .ensureAlpha()
      .raw()
      .toBuffer();


  // ----------------------------------------------------------
  // Total number of pixels
  // ----------------------------------------------------------

  const totalPixels =
    widthA * heightA;


  // ----------------------------------------------------------
  // Buffer used by pixelmatch for the generated difference
  // ----------------------------------------------------------

  const diffBuffer =
    Buffer.alloc(
      imageA.length
    );


  // ----------------------------------------------------------
  // Compare pixels
  // ----------------------------------------------------------

  const diffPixels =
    pixelmatch(
      imageA,
      imageB,
      diffBuffer,
      widthA,
      heightA,
      {
        threshold: 0.1,
        includeAA: false
      }
    );


  // ----------------------------------------------------------
  // Calculate percentage
  // ----------------------------------------------------------

  const differencePercent =
    totalPixels === 0
      ? 0
      : (
          diffPixels /
          totalPixels
        ) * 100;


  // ----------------------------------------------------------
  // Return result
  // ----------------------------------------------------------

  return {

    identical:
      diffPixels === 0,

    comparable:
      true,

    widthA,
    heightA,

    widthB,
    heightB,

    diffPixels,

    totalPixels,

    differencePercent:
      Number(
        differencePercent.toFixed(4)
      ),

    message:
      diffPixels === 0
        ? 'Images are pixel-identical.'
        : `${diffPixels.toLocaleString()} pixels differ.`
  };
}



// ============================================================
// GET /api/documents/:id/versions
// ============================================================
//
// Returns all versions of a document.
//
// ============================================================

async function listVersions(req, res) {

  try {

    const { id } =
      req.params;


    const result =
      await pool.query(
        `SELECT
           v.*,
           u.username AS uploaded_by_username
         FROM document_versions v
         JOIN users u
           ON v.uploaded_by = u.id
         WHERE v.document_id = $1
         ORDER BY v.version_number DESC`,
        [id]
      );


    return res.json({
      success: true,
      versions: result.rows
    });


  } catch (err) {

    console.error(
      '[ERROR] listVersions:',
      err.message
    );


    return res.status(500).json({
      success: false,
      message:
        'Failed to list versions'
    });
  }
}



// ============================================================
// GET /api/documents/:id/versions/:versionId/download
// ============================================================
//
// Downloads a selected version.
//
// ============================================================

async function downloadVersion(req, res) {

  try {

    const {
      id,
      versionId
    } = req.params;


    // --------------------------------------------------------
    // Find requested version
    // --------------------------------------------------------

    const result =
      await pool.query(
        `SELECT *
         FROM document_versions
         WHERE id = $1
           AND document_id = $2`,
        [
          versionId,
          id
        ]
      );


    if (
      result.rows.length === 0
    ) {

      return res.status(404).json({
        success: false,
        message:
          'Version not found'
      });
    }


    const version =
      result.rows[0];


    // --------------------------------------------------------
    // File must exist
    // --------------------------------------------------------

    if (
      !validateVersionFile(
        version.file_path
      )
    ) {

      return res.status(404).json({
        success: false,
        message:
          'File missing on server'
      });
    }


    // --------------------------------------------------------
    // Audit download
    // --------------------------------------------------------

    await logAction({
      userId:
        req.user.userId,

      action:
        'DOWNLOAD',

      entityType:
        'document_version',

      entityId:
        version.id,

      details: {
        documentId:
          Number(id),

        versionNumber:
          version.version_number
      },

      req
    });


    // --------------------------------------------------------
    // Download
    // --------------------------------------------------------

    return res.download(
      version.file_path,

      `v${version.version_number}-${version.file_name}`
    );


  } catch (err) {

    console.error(
      '[ERROR] downloadVersion:',
      err.message
    );


    return res.status(500).json({
      success: false,
      message:
        'Failed to download version'
    });
  }
}



// ============================================================
// POST /api/documents/:id/versions/:versionId/restore
// ============================================================
//
// Restoring an old version DOES NOT delete history.
//
// Instead:
//
// Old Version
//      ↓
// copy physical file
//      ↓
// create NEW version number
//      ↓
// new version becomes current
//
// ============================================================

async function restoreVersion(req, res) {

  try {

    const {
      id,
      versionId
    } = req.params;


    const uploadedBy =
      req.user.userId;


    // --------------------------------------------------------
    // Find old version
    // --------------------------------------------------------

    const oldVersionResult =
      await pool.query(
        `SELECT *
         FROM document_versions
         WHERE id = $1
           AND document_id = $2`,
        [
          versionId,
          id
        ]
      );


    if (
      oldVersionResult.rows.length === 0
    ) {

      return res.status(404).json({
        success: false,
        message:
          'Version not found'
      });
    }


    const oldVersion =
      oldVersionResult.rows[0];


    // --------------------------------------------------------
    // Verify original file exists
    // --------------------------------------------------------

    if (
      !validateVersionFile(
        oldVersion.file_path
      )
    ) {

      return res.status(404).json({
        success: false,
        message:
          'Original version file is missing on server'
      });
    }


    // --------------------------------------------------------
    // Get latest version number
    // --------------------------------------------------------

    const lastVersionResult =
      await pool.query(
        `SELECT *
         FROM document_versions
         WHERE document_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [id]
      );


    if (
      lastVersionResult.rows.length === 0
    ) {

      return res.status(404).json({
        success: false,
        message:
          'No existing versions found'
      });
    }


    const currentVersion =
      lastVersionResult.rows[0];


    const nextVersionNumber =
      Number(
        currentVersion.version_number
      ) + 1;


    // --------------------------------------------------------
    // Create restored physical file
    // --------------------------------------------------------

    const uploadDir =
      path.dirname(
        oldVersion.file_path
      );


    const ext =
      path.extname(
        oldVersion.file_name
      );


    const newFileName =
      `${Date.now()}-restore${ext}`;


    const newFilePath =
      path.join(
        uploadDir,
        newFileName
      );


    fs.copyFileSync(
      oldVersion.file_path,
      newFilePath
    );


    // --------------------------------------------------------
    // Calculate hash of restored file
    // --------------------------------------------------------

    const sha256Hash =
      await sha256File(
        newFilePath
      );


    // --------------------------------------------------------
    // Database transaction
    // --------------------------------------------------------

    const client =
      await pool.connect();


    try {

      await client.query(
        'BEGIN'
      );


      // ------------------------------------------------------
      // Previous current version is no longer current
      // ------------------------------------------------------

      await client.query(
        `UPDATE document_versions
         SET is_current = FALSE
         WHERE document_id = $1`,
        [id]
      );


      // ------------------------------------------------------
      // Create new restored version
      // ------------------------------------------------------

      const versionResult =
        await client.query(
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

            newFileName,

            newFilePath,

            oldVersion.file_size,

            oldVersion.mime_type,

            sha256Hash,

            `Restored from version ${oldVersion.version_number}`,

            uploadedBy
          ]
        );


      const newVersion =
        versionResult.rows[0];


      // ------------------------------------------------------
      // Update logical document
      // ------------------------------------------------------

      const updatedDocResult =
        await client.query(
          `UPDATE documents
           SET file_name = $1,
               file_path = $2,
               file_size = $3,
               mime_type = $4,
               latest_version_id = $5,
               status = 'pending_review',
               checked_out_by = NULL,
               checked_out_at = NULL,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
          [
            newFileName,

            newFilePath,

            oldVersion.file_size,

            oldVersion.mime_type,

            newVersion.id,

            id
          ]
        );


      await client.query(
        'COMMIT'
      );


      // ------------------------------------------------------
      // Register restored version on blockchain-style ledger
      // ------------------------------------------------------

      const block =
        await registerOnBlockchain({
          documentId:
            Number(id),

          versionId:
            newVersion.id,

          dataHash:
            sha256Hash,

          registeredBy:
            uploadedBy
        });


      // ------------------------------------------------------
      // Audit
      // ------------------------------------------------------

      await logAction({
        userId:
          uploadedBy,

        action:
          'VERSION_RESTORE',

        entityType:
          'document',

        entityId:
          Number(id),

        details: {

          restoredFromVersion:
            oldVersion.version_number,

          newVersion:
            nextVersionNumber,

          hash:
            sha256Hash,

          blockchainTxId:
            block.tx_id
        },

        req
      });


      return res.json({

        success:
          true,

        document:
          updatedDocResult.rows[0],

        version:
          newVersion,

        blockchain:
          block
      });


    } catch (err) {

      await client.query(
        'ROLLBACK'
      );

      throw err;

    } finally {

      client.release();
    }


  } catch (err) {

    console.error(
      '[ERROR] restoreVersion:',
      err.message
    );


    return res.status(500).json({
      success: false,
      message:
        'Failed to restore version'
    });
  }
}



// ============================================================
// GET /api/documents/:id/versions/compare
//
// Example:
//
// /api/documents/10/versions/compare?v1=1&v2=2
//
// ============================================================
//
// SUPPORTED:
//
// TXT
// DOC
// DOCX
// PDF
// PNG
// JPG
// JPEG
//
// ============================================================

async function compareVersions(req, res) {

  try {

    const {
      id
    } = req.params;


    const {
      v1,
      v2
    } = req.query;


    // --------------------------------------------------------
    // Validate parameters
    // --------------------------------------------------------

    if (
      !v1 ||
      !v2
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          'v1 and v2 query params (version numbers) are required'
      });
    }


    // --------------------------------------------------------
    // Same version
    // --------------------------------------------------------

    if (
      String(v1) ===
      String(v2)
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          'Please select two different versions to compare'
      });
    }


    // --------------------------------------------------------
    // Get both versions
    // --------------------------------------------------------

    const result =
      await pool.query(
        `SELECT *
         FROM document_versions
         WHERE document_id = $1
           AND version_number IN ($2, $3)`,
        [
          id,
          v1,
          v2
        ]
      );


    // --------------------------------------------------------
    // Both versions must exist
    // --------------------------------------------------------

    if (
      result.rows.length !== 2
    ) {

      return res.status(404).json({

        success:
          false,

        message:
          'One or both versions not found'
      });
    }


    // --------------------------------------------------------
    // Identify Version A
    // --------------------------------------------------------

    const versionA =
      result.rows.find(
        version =>
          String(
            version.version_number
          ) === String(v1)
      );


    // --------------------------------------------------------
    // Identify Version B
    // --------------------------------------------------------

    const versionB =
      result.rows.find(
        version =>
          String(
            version.version_number
          ) === String(v2)
      );


    if (
      !versionA ||
      !versionB
    ) {

      return res.status(404).json({

        success:
          false,

        message:
          'Unable to identify both requested versions'
      });
    }


    // --------------------------------------------------------
    // SHA-256 comparison
    // --------------------------------------------------------

    const hashesDiffer =
      versionA.sha256_hash !==
      versionB.sha256_hash;


    // --------------------------------------------------------
    // Base response
    // --------------------------------------------------------

    const base = {

      success:
        true,


      versionA: {

        id:
          versionA.id,

        version_number:
          versionA.version_number,

        file_name:
          versionA.file_name,

        mime_type:
          versionA.mime_type,

        sha256_hash:
          versionA.sha256_hash,

        change_summary:
          versionA.change_summary
      },


      versionB: {

        id:
          versionB.id,

        version_number:
          versionB.version_number,

        file_name:
          versionB.file_name,

        mime_type:
          versionB.mime_type,

        sha256_hash:
          versionB.sha256_hash,

        change_summary:
          versionB.change_summary
      },


      hashesDiffer
    };


    // --------------------------------------------------------
    // Check physical files
    // --------------------------------------------------------

    if (
      !validateVersionFile(
        versionA.file_path
      ) ||
      !validateVersionFile(
        versionB.file_path
      )
    ) {

      return res.status(404).json({

        ...base,

        supported:
          false,

        message:
          'One or both version files are missing on the server',

        diffLines:
          [],

        changeStats: {

          added:
            0,

          removed:
            0,

          modified:
            hashesDiffer
              ? 1
              : 0,

          total:
            hashesDiffer
              ? 1
              : 0
        }
      });
    }


    // --------------------------------------------------------
    // Determine file types
    // --------------------------------------------------------

    const typeA =
      getComparisonType(
        versionA
      );


    const typeB =
      getComparisonType(
        versionB
      );


    console.log(
      '[COMPARE] File information:',
      {
        documentId:
          id,

        versionA:
          versionA.version_number,

        versionB:
          versionB.version_number,

        fileA:
          versionA.file_name,

        fileB:
          versionB.file_name,

        mimeA:
          versionA.mime_type,

        mimeB:
          versionB.mime_type,

        typeA,

        typeB,

        hashesDiffer
      }
    );


    // ========================================================
    // TEXT-BASED FORMATS
    // ========================================================

    const textTypes = [
      'text',
      'doc',
      'docx',
      'pdf'
    ];


    if (
      typeA === typeB &&
      textTypes.includes(typeA)
    ) {

      console.log(
        `[COMPARE] Performing ${typeA} text comparison`
      );


      let textA;
      let textB;


      // ------------------------------------------------------
      // Extract Version A
      // ------------------------------------------------------

      try {

        textA =
          await extractComparableText(
            versionA.file_path,
            typeA
          );

      } catch (error) {

        console.error(
          '[COMPARE] Version A extraction failed:',
          error
        );


        return res.status(422).json({

          ...base,

          supported:
            false,

          comparisonType:
            typeA,

          message:
            `Unable to extract text from Version ${versionA.version_number}.`,

          extractionError:
            error.message,

          diffLines:
            [],

          changeStats: {

            added:
              0,

            removed:
              0,

            modified:
              hashesDiffer
                ? 1
                : 0,

            total:
              hashesDiffer
                ? 1
                : 0
          }
        });
      }


      // ------------------------------------------------------
      // Extract Version B
      // ------------------------------------------------------

      try {

        textB =
          await extractComparableText(
            versionB.file_path,
            typeB
          );

      } catch (error) {

        console.error(
          '[COMPARE] Version B extraction failed:',
          error
        );


        return res.status(422).json({

          ...base,

          supported:
            false,

          comparisonType:
            typeB,

          message:
            `Unable to extract text from Version ${versionB.version_number}.`,

          extractionError:
            error.message,

          diffLines:
            [],

          changeStats: {

            added:
              0,

            removed:
              0,

            modified:
              hashesDiffer
                ? 1
                : 0,

            total:
              hashesDiffer
                ? 1
                : 0
          }
        });
      }


      // ------------------------------------------------------
      // Build line-by-line difference
      // ------------------------------------------------------

      const diff =
        buildLineDiff(
          textA,
          textB
        );


      // ------------------------------------------------------
      // Calculate change statistics
      // ------------------------------------------------------

      const changeStats =
        diff.diffLines.reduce(

          (stats, line) => {

            if (
              line.type === 'added'
            ) {

              stats.added += 1;

            }

            else if (
              line.type === 'removed'
            ) {

              stats.removed += 1;

            }

            else if (
              line.type === 'modified'
            ) {

              stats.modified += 1;

            }

            stats.total += 1;

            return stats;
          },

          {
            added:
              0,

            removed:
              0,

            modified:
              0,

            total:
              0
          }
        );


      // ------------------------------------------------------
      // Generate meaningful message
      // ------------------------------------------------------

      let message;


      // Exact same SHA-256
      if (
        !hashesDiffer
      ) {

        message =
          'The two versions are identical. No content changes detected.';
      }


      // Hash differs but extracted text is same
      else if (
        diff.diffLines.length === 0
      ) {

        message =
          `${typeA.toUpperCase()} text content is unchanged, ` +
          `but the file hashes differ. The difference may be caused ` +
          `by formatting, metadata, embedded objects, or other non-text content.`;
      }


      // Actual changes
      else {

        message =
          `${typeA.toUpperCase()} versions compared successfully. ` +
          `${changeStats.total} changed line entries detected.`;
      }


      // ------------------------------------------------------
      // Return text comparison
      // ------------------------------------------------------

      return res.json({

        ...base,

        supported:
          true,

        comparisonType:
          typeA,

        approximate:
          Boolean(
            diff.approximate
          ),

        message,

        changeStats,

        diffLines:
          diff.diffLines || []
      });
    }


    // ========================================================
    // IMAGE COMPARISON
    // ========================================================

    if (
      typeA === 'image' &&
      typeB === 'image'
    ) {

      console.log(
        '[COMPARE] Performing pixel-level image comparison'
      );


      let imageComparison;


      try {

        imageComparison =
          await compareImages(
            versionA.file_path,
            versionB.file_path
          );

      } catch (error) {

        console.error(
          '[COMPARE] Image comparison failed:',
          error
        );


        return res.status(422).json({

          ...base,

          supported:
            false,

          comparisonType:
            'image',

          message:
            'Unable to compare the image files. SHA-256 hashes are still available.',

          comparisonError:
            error.message,

          diffLines:
            [],

          changeStats: {

            added:
              0,

            removed:
              0,

            modified:
              hashesDiffer
                ? 1
                : 0,

            total:
              hashesDiffer
                ? 1
                : 0
          }
        });
      }


      // ------------------------------------------------------
      // Different dimensions
      // ------------------------------------------------------

      if (
        !imageComparison.comparable
      ) {

        return res.json({

          ...base,

          supported:
            true,

          comparisonType:
            'image',

          imageComparison,

          message:
            imageComparison.message,

          diffLines:
            [],

          changeStats: {

            added:
              0,

            removed:
              0,

            modified:
              hashesDiffer
                ? 1
                : 0,

            total:
              hashesDiffer
                ? 1
                : 0
          }
        });
      }


      // ------------------------------------------------------
      // Same dimensions
      // ------------------------------------------------------

      return res.json({

        ...base,

        supported:
          true,

        comparisonType:
          'image',

        imageComparison,

        message:
          imageComparison.message,

        diffLines:
          [],

        changeStats: {

          added:
            0,

          removed:
            0,

          modified:
            imageComparison.diffPixels > 0
              ? 1
              : 0,

          total:
            imageComparison.diffPixels > 0
              ? 1
              : 0
        }
      });
    }


    // ========================================================
    // MIXED FILE TYPES
    // ========================================================
    //
    // Example:
    //
    // Version 1 = DOCX
    // Version 2 = PDF
    //
    // We do NOT attempt to compare unrelated formats.
    //
    // ========================================================

    if (
      typeA !== typeB
    ) {

      return res.json({

        ...base,

        supported:
          false,

        comparisonType:
          'mixed',

        typeA,

        typeB,

        message:
          `The two versions have different file types ` +
          `(${typeA.toUpperCase()} vs ${typeB.toUpperCase()}). ` +
          `Content-level comparison is not performed between different formats. ` +
          `SHA-256 hashes are provided to confirm whether the files differ.`,

        diffLines:
          [],

        changeStats: {

          added:
            0,

          removed:
            0,

          modified:
            hashesDiffer
              ? 1
              : 0,

          total:
            hashesDiffer
              ? 1
              : 0
        }
      });
    }


    // ========================================================
    // UNKNOWN FILE TYPE
    // ========================================================

    return res.json({

      ...base,

      supported:
        false,

      comparisonType:
        typeA,

      message:
        `Content-level comparison is not available for this file type. ` +
        `SHA-256 hashes are provided instead.`,

      diffLines:
        [],

      changeStats: {

        added:
          0,

        removed:
          0,

        modified:
          hashesDiffer
            ? 1
            : 0,

        total:
          hashesDiffer
            ? 1
            : 0
      }
    });


  } catch (err) {

    console.error(
      '[ERROR] compareVersions:',
      err
    );


    return res.status(500).json({

      success:
        false,

      message:
        'Failed to compare versions',

      error:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined
    });
  }
}



// ============================================================
// POST /api/documents/:id/versions/:versionId/publish
// ============================================================
//
// Publishes an APPROVED version.
//
// Rules:
//
// 1. Version must exist.
// 2. Version must belong to document.
// 3. Document must not be deleted.
// 4. Version must be approved.
// 5. Previous published version becomes superseded.
// 6. Selected version becomes published.
// 7. Document published_version_id is updated.
// 8. Operation uses a transaction.
// 9. Audit log is recorded.
//
// ============================================================

async function publishVersion(req, res) {

  const client =
    await pool.connect();


  try {

    const {
      id,
      versionId
    } = req.params;


    const userId =
      req.user.userId;


    await client.query(
      'BEGIN'
    );


    // --------------------------------------------------------
    // Get version
    // --------------------------------------------------------

    const versionResult =
      await client.query(
        `SELECT
           v.*,
           d.title,
           d.published_version_id
         FROM document_versions v
         JOIN documents d
           ON d.id = v.document_id
         WHERE v.id = $1
           AND v.document_id = $2
           AND d.is_deleted = FALSE
         FOR UPDATE`,
        [
          versionId,
          id
        ]
      );


    // --------------------------------------------------------
    // Version not found
    // --------------------------------------------------------

    if (
      versionResult.rows.length === 0
    ) {

      await client.query(
        'ROLLBACK'
      );


      return res.status(404).json({

        success:
          false,

        message:
          'Version not found'
      });
    }


    const version =
      versionResult.rows[0];


    // --------------------------------------------------------
    // Only approved versions can be published
    // --------------------------------------------------------

    if (
      version.version_status !==
      'approved'
    ) {

      await client.query(
        'ROLLBACK'
      );


      return res.status(409).json({

        success:
          false,

        message:
          `Version ${version.version_number} cannot be published`,

        versionStatus:
          version.version_status
      });
    }


    // --------------------------------------------------------
    // Supersede previous published version
    // --------------------------------------------------------

    if (
      version.published_version_id
    ) {

      await client.query(
        `UPDATE document_versions
         SET version_status = 'superseded'
         WHERE id = $1
           AND id <> $2`,
        [
          version.published_version_id,
          version.id
        ]
      );
    }


    // --------------------------------------------------------
    // Mark selected version as published
    // --------------------------------------------------------

    const publishedVersionResult =
      await client.query(
        `UPDATE document_versions
         SET version_status = 'published'
         WHERE id = $1
         RETURNING *`,
        [
          version.id
        ]
      );


    const publishedVersion =
      publishedVersionResult.rows[0];


    // --------------------------------------------------------
    // Update document pointers
    // --------------------------------------------------------

    const documentResult =
      await client.query(
        `UPDATE documents
         SET published_version_id = $1,
             latest_version_id = CASE
               WHEN latest_version_id IS NULL
               THEN $1
               ELSE latest_version_id
             END,
             status = 'approved',
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [
          publishedVersion.id,
          id
        ]
      );


    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    await client.query(
      'COMMIT'
    );


    // --------------------------------------------------------
    // Audit log
    // --------------------------------------------------------

    await logAction({

      userId,

      action:
        'VERSION_PUBLISHED',

      entityType:
        'document_version',

      entityId:
        publishedVersion.id,

      details: {

        documentId:
          Number(id),

        versionNumber:
          publishedVersion.version_number,

        sha256Hash:
          publishedVersion.sha256_hash
      },

      req
    });


    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.json({

      success:
        true,

      message:
        `Version ${publishedVersion.version_number} published successfully`,

      version:
        publishedVersion,

      document:
        documentResult.rows[0]
    });


  } catch (err) {

    // --------------------------------------------------------
    // Rollback if transaction is still active
    // --------------------------------------------------------

    try {

      await client.query(
        'ROLLBACK'
      );

    } catch (rollbackError) {

      console.error(
        '[ERROR] publishVersion rollback:',
        rollbackError.message
      );
    }


    console.error(
      '[ERROR] publishVersion:',
      err.message
    );


    return res.status(500).json({

      success:
        false,

      message:
        'Failed to publish version'
    });


  } finally {

    client.release();
  }
}



// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  listVersions,

  downloadVersion,

  restoreVersion,

  compareVersions,

  publishVersion

};