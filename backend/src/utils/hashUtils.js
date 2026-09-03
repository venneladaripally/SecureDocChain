const crypto = require('crypto');
const fs = require('fs');


// ============================================================
// SHA-256 FILE HASH
// ============================================================
//
// Reads the file as a stream so large documents do not have to
// be loaded completely into memory.
//
// Returns:
//   64-character hexadecimal SHA-256 hash
// ============================================================

function sha256File(filePath) {

  return new Promise((resolve, reject) => {

    if (
      typeof filePath !== 'string' ||
      !filePath.trim()
    ) {
      return reject(
        new Error(
          'A valid file path is required'
        )
      );
    }


    const hash =
      crypto.createHash('sha256');


    const stream =
      fs.createReadStream(
        filePath
      );


    stream.on(
      'data',
      (chunk) => {
        hash.update(chunk);
      }
    );


    stream.on(
      'end',
      () => {

        try {

          const digest =
            hash.digest('hex');

          resolve(digest);

        } catch (err) {

          reject(err);

        }

      }
    );


    stream.on(
      'error',
      (err) => {
        reject(err);
      }
    );

  });
}


// ============================================================
// SHA-256 STRING HASH
// ============================================================
//
// Used by the blockchain utility to calculate a deterministic
// hash from block data.
//
// UTF-8 is explicitly specified so the same input produces the
// same hash consistently.
// ============================================================

function sha256String(value) {

  if (
    value === null ||
    value === undefined
  ) {
    throw new Error(
      'A value is required to calculate SHA-256'
    );
  }


  return crypto
    .createHash('sha256')
    .update(
      String(value),
      'utf8'
    )
    .digest('hex');
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  sha256File,
  sha256String
};