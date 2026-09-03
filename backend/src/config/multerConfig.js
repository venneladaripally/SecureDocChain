const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


// ============================================================
// UPLOAD DIRECTORIES
// ============================================================

const uploadDir = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'documents'
);

const tempDir = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'temp'
);


// Create directories if they do not already exist.
for (const dir of [uploadDir, tempDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
}


// ============================================================
// FILE UPLOAD CONFIGURATION
// ============================================================

const MAX_FILE_SIZE =
  10 * 1024 * 1024; // 10 MB


// ============================================================
// ALLOWED FILE TYPES
// ============================================================
//
// MIME type alone should not be trusted because clients can
// provide arbitrary MIME values.
//
// We therefore validate:
//
// 1. MIME type
// 2. File extension
// ============================================================

const ALLOWED_FILE_TYPES = {

  'application/pdf': [
    '.pdf'
  ],

  'application/msword': [
    '.doc'
  ],

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx'
  ],

  'image/png': [
    '.png'
  ],

  'image/jpeg': [
    '.jpg',
    '.jpeg'
  ],

  'text/plain': [
    '.txt'
  ]

};


const ALLOWED_MIME_TYPES =
  Object.keys(
    ALLOWED_FILE_TYPES
  );


// ============================================================
// SAFE RANDOM FILE NAME
// ============================================================

function generateSafeFileName(prefix = '') {

  const timestamp =
    Date.now();

  const randomPart =
    crypto
      .randomBytes(16)
      .toString('hex');

  return `${prefix}${timestamp}-${randomPart}`;
}


// ============================================================
// GET SAFE EXTENSION
// ============================================================

function getSafeExtension(
  originalName
) {

  const extension =
    path.extname(
      originalName || ''
    ).toLowerCase();

  return extension;
}


// ============================================================
// VALIDATE FILE
// ============================================================

function validateUploadedFile(
  file
) {

  if (
    !file ||
    typeof file.mimetype !== 'string'
  ) {
    return {
      valid: false,
      message:
        'Invalid uploaded file'
    };
  }


  // ----------------------------------------------------------
  // MIME TYPE
  // ----------------------------------------------------------

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.mimetype
    )
  ) {

    return {
      valid: false,
      message:
        `Unsupported file type: ${file.mimetype}`
    };
  }


  // ----------------------------------------------------------
  // FILE EXTENSION
  // ----------------------------------------------------------

  const extension =
    getSafeExtension(
      file.originalname
    );


  const allowedExtensions =
    ALLOWED_FILE_TYPES[
      file.mimetype
    ] || [];


  if (
    !allowedExtensions.includes(
      extension
    )
  ) {

    return {
      valid: false,
      message:
        'File extension does not match the uploaded file type'
    };
  }


  return {
    valid: true
  };
}


// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (
  req,
  file,
  cb
) => {

  const validation =
    validateUploadedFile(
      file
    );


  if (!validation.valid) {

    return cb(
      new Error(
        validation.message
      ),
      false
    );
  }


  cb(
    null,
    true
  );
};


// ============================================================
// PERMANENT DOCUMENT STORAGE
// ============================================================
//
// Used by:
//
// POST /api/documents
// POST /api/documents/:id/edit
//
// Files are stored in:
//
// uploads/documents/
// ============================================================

const storage =
  multer.diskStorage({

    destination: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        uploadDir
      );

    },


    filename: (
      req,
      file,
      cb
    ) => {

      const extension =
        getSafeExtension(
          file.originalname
        );


      const safeName =
        generateSafeFileName();


      cb(
        null,
        `${safeName}${extension}`
      );

    }

  });


// ============================================================
// TEMPORARY FILE STORAGE
// ============================================================
//
// Used by document verification.
//
// Files are stored in:
//
// uploads/temp/
// ============================================================

const tempStorage =
  multer.diskStorage({

    destination: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        tempDir
      );

    },


    filename: (
      req,
      file,
      cb
    ) => {

      const extension =
        getSafeExtension(
          file.originalname
        );


      const safeName =
        generateSafeFileName(
          'verify-'
        );


      cb(
        null,
        `${safeName}${extension}`
      );

    }

  });


// ============================================================
// PERMANENT DOCUMENT UPLOAD
// ============================================================

const upload =
  multer({

    storage,

    fileFilter,

    limits: {

      fileSize:
        MAX_FILE_SIZE,

      files: 1

    }

  });


// ============================================================
// TEMPORARY VERIFICATION UPLOAD
// ============================================================

const uploadTemp =
  multer({

    storage:
      tempStorage,

    fileFilter,

    limits: {

      fileSize:
        MAX_FILE_SIZE,

      files: 1

    }

  });


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  upload,

  uploadTemp,

  ALLOWED_MIME_TYPES,

  MAX_FILE_SIZE

};