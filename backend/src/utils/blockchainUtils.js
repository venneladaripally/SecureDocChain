const crypto = require('crypto');

const pool = require('../config/database');
const { sha256String } = require('./hashUtils');


// ============================================================
// BLOCKCHAIN CONFIGURATION
// ============================================================

// A block is valid only when its SHA-256 hash starts with "00".
//
// Example:
// 00a8f4...
//
// This is a small proof-of-work difficulty suitable for a
// local/academic project.
const DIFFICULTY_PREFIX = '00';


// Genesis block previous hash.
const GENESIS_HASH = '0'.repeat(64);


// ============================================================
// COMPUTE BLOCK HASH
// ============================================================
//
// The hash is calculated from the complete block contents:
//
// block index
// previous block hash
// document/version hash
// timestamp
// nonce
//
// Any modification to one of these values changes the block hash.
// ============================================================

function computeBlockHash({
  blockIndex,
  prevBlockHash,
  dataHash,
  timestamp,
  nonce
}) {
  return sha256String(
    `${blockIndex}|${prevBlockHash}|${dataHash}|${timestamp}|${nonce}`
  );
}


// ============================================================
// VALIDATE SHA-256 HASH
// ============================================================

function isValidSha256Hash(hash) {
  return (
    typeof hash === 'string' &&
    /^[a-fA-F0-9]{64}$/.test(hash)
  );
}


// ============================================================
// MINE BLOCK
// ============================================================
//
// Finds a nonce that produces a hash beginning with the
// configured difficulty prefix.
//
// This is intentionally synchronous because the difficulty
// is small ("00").
// ============================================================

function mineBlock(params) {
  let nonce = 0;

  while (true) {
    const hash = computeBlockHash({
      ...params,
      nonce
    });

    if (hash.startsWith(DIFFICULTY_PREFIX)) {
      return {
        nonce,
        hash
      };
    }

    nonce += 1;
  }
}


// ============================================================
// REGISTER DOCUMENT VERSION ON BLOCKCHAIN
// ============================================================
//
// Creates exactly one blockchain transaction for a document
// version.
//
// IMPORTANT:
// PostgreSQL advisory transaction locking is used so that two
// simultaneous uploads cannot both receive the same block index.
//
// Flow:
//
// BEGIN
//   ↓
// acquire blockchain lock
//   ↓
// read latest block
//   ↓
// calculate next block index
//   ↓
// mine block
//   ↓
// insert block
//   ↓
// COMMIT
// ============================================================

async function registerOnBlockchain({
  documentId,
  versionId,
  dataHash,
  registeredBy
}) {
  const client = await pool.connect();

  try {

    // ----------------------------------------------------------
    // Basic validation
    // ----------------------------------------------------------

    const parsedDocumentId = Number(documentId);
    const parsedVersionId = Number(versionId);
    const parsedRegisteredBy = Number(registeredBy);

    if (
      !Number.isInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      throw new Error(
        'Invalid documentId for blockchain registration'
      );
    }

    if (
      !Number.isInteger(parsedVersionId) ||
      parsedVersionId <= 0
    ) {
      throw new Error(
        'Invalid versionId for blockchain registration'
      );
    }

    if (
      !Number.isInteger(parsedRegisteredBy) ||
      parsedRegisteredBy <= 0
    ) {
      throw new Error(
        'Invalid registeredBy for blockchain registration'
      );
    }

    if (!isValidSha256Hash(dataHash)) {
      throw new Error(
        'Invalid SHA-256 dataHash for blockchain registration'
      );
    }


    // ----------------------------------------------------------
    // Start transaction
    // ----------------------------------------------------------

    await client.query('BEGIN');


    // ----------------------------------------------------------
    // PostgreSQL advisory transaction lock
    //
    // The same lock key is used by every blockchain insertion.
    //
    // This means:
    //
    // Request A:
    //   gets blockchain lock
    //
    // Request B:
    //   waits
    //
    // Request A:
    //   inserts block
    //   commits
    //
    // Request B:
    //   gets lock
    //   reads the newly inserted block
    //   creates the next block
    // ----------------------------------------------------------

    await client.query(
      `SELECT pg_advisory_xact_lock(738291)`
    );


    // ----------------------------------------------------------
    // Verify referenced document version exists
    // ----------------------------------------------------------

    const versionResult =
      await client.query(
        `SELECT
           v.id,
           v.document_id,
           v.sha256_hash
         FROM document_versions v
         WHERE v.id = $1
           AND v.document_id = $2`,
        [
          parsedVersionId,
          parsedDocumentId
        ]
      );


    if (versionResult.rows.length === 0) {
      throw new Error(
        'Document version not found for blockchain registration'
      );
    }


    const version =
      versionResult.rows[0];


    // ----------------------------------------------------------
    // Make sure blockchain data hash matches the version hash
    // ----------------------------------------------------------

    if (
      version.sha256_hash.toLowerCase() !==
      dataHash.toLowerCase()
    ) {
      throw new Error(
        'Blockchain data hash does not match document version hash'
      );
    }


    // ----------------------------------------------------------
    // Prevent duplicate blockchain registration
    //
    // A version should normally be registered only once.
    // ----------------------------------------------------------

    const existingResult =
      await client.query(
        `SELECT *
         FROM blockchain_transactions
         WHERE version_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [parsedVersionId]
      );


    if (existingResult.rows.length > 0) {

      await client.query('COMMIT');

      return existingResult.rows[0];
    }


    // ----------------------------------------------------------
    // Get the latest blockchain block
    // ----------------------------------------------------------

    const lastBlockResult =
      await client.query(
        `SELECT
           block_index,
           block_hash
         FROM blockchain_transactions
         ORDER BY block_index DESC
         LIMIT 1`
      );


    const blockIndex =
      lastBlockResult.rows.length > 0
        ? Number(
            lastBlockResult.rows[0].block_index
          ) + 1
        : 0;


    const prevBlockHash =
      lastBlockResult.rows.length > 0
        ? lastBlockResult.rows[0].block_hash
        : GENESIS_HASH;


    // ----------------------------------------------------------
    // Create timestamp
    // ----------------------------------------------------------

    const timestamp =
      Date.now();


    // ----------------------------------------------------------
    // Mine block
    // ----------------------------------------------------------

    const minedBlock =
      mineBlock({
        blockIndex,
        prevBlockHash,
        dataHash,
        timestamp
      });


    const {
      nonce,
      hash
    } = minedBlock;


    // ----------------------------------------------------------
    // Generate transaction ID
    // ----------------------------------------------------------

    const txId =
      `TX-${timestamp}-${crypto
        .randomBytes(4)
        .toString('hex')}`;


    // ----------------------------------------------------------
    // Insert blockchain transaction
    // ----------------------------------------------------------

    const insertResult =
      await client.query(
        `INSERT INTO blockchain_transactions (
           document_id,
           version_id,
           block_index,
           data_hash,
           prev_block_hash,
           block_hash,
           nonce,
           timestamp_ms,
           tx_id,
           status,
           registered_by
         )

         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           'confirmed',
           $10
         )

         RETURNING *`,
        [
          parsedDocumentId,
          parsedVersionId,
          blockIndex,
          dataHash.toLowerCase(),
          prevBlockHash,
          hash,
          nonce,
          timestamp,
          txId,
          parsedRegisteredBy
        ]
      );


    const block =
      insertResult.rows[0];


    // ----------------------------------------------------------
    // Commit blockchain transaction
    // ----------------------------------------------------------

    await client.query('COMMIT');


    return block;


  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[ERROR] Blockchain rollback failed:',
        rollbackError.message
      );
    }

    console.error(
      '[ERROR] registerOnBlockchain:',
      err.message
    );

    throw err;


  } finally {

    client.release();

  }
}


// ============================================================
// VERIFY ENTIRE BLOCKCHAIN
// ============================================================
//
// Checks:
//
// 1. Block indexes are sequential.
// 2. First block points to the genesis hash.
// 3. Every later block points to the previous block hash.
// 4. Block hash can be recomputed correctly.
// 5. Proof-of-work requirement is satisfied.
// 6. Data hash is a valid SHA-256 hash.
// 7. Transaction status is confirmed.
// ============================================================

async function verifyChain() {

  try {

    const result =
      await pool.query(
        `SELECT *
         FROM blockchain_transactions
         ORDER BY block_index ASC`
      );


    let previousHash =
      GENESIS_HASH;

    let expectedBlockIndex =
      0;

    const brokenBlocks = [];


    for (const block of result.rows) {

      // --------------------------------------------------------
      // Validate block index
      // --------------------------------------------------------

      const blockIndex =
        Number(block.block_index);


      const indexOk =
        blockIndex === expectedBlockIndex;


      // --------------------------------------------------------
      // Validate previous block link
      // --------------------------------------------------------

      const linkOk =
        block.prev_block_hash ===
        previousHash;


      // --------------------------------------------------------
      // Validate data hash format
      // --------------------------------------------------------

      const dataHashOk =
        isValidSha256Hash(
          block.data_hash
        );


      // --------------------------------------------------------
      // Recalculate block hash
      // --------------------------------------------------------

      const recomputedHash =
        computeBlockHash({

          blockIndex:
            block.block_index,

          prevBlockHash:
            block.prev_block_hash,

          dataHash:
            block.data_hash,

          timestamp:
            Number(block.timestamp_ms),

          nonce:
            Number(block.nonce)
        });


      // --------------------------------------------------------
      // Validate stored hash
      // --------------------------------------------------------

      const hashMatches =
        recomputedHash ===
        block.block_hash;


      // --------------------------------------------------------
      // Validate proof of work
      // --------------------------------------------------------

      const proofOfWorkOk =
        typeof block.block_hash === 'string' &&
        block.block_hash.startsWith(
          DIFFICULTY_PREFIX
        );


      // --------------------------------------------------------
      // Validate status
      // --------------------------------------------------------

      const statusOk =
        block.status === 'confirmed';


      // --------------------------------------------------------
      // Block is valid only when ALL checks pass
      // --------------------------------------------------------

      const blockValid =
        indexOk &&
        linkOk &&
        dataHashOk &&
        hashMatches &&
        proofOfWorkOk &&
        statusOk;


      if (!blockValid) {
        brokenBlocks.push(
          block.id
        );
      }


      // The stored hash becomes the expected previous hash
      // for the next block.
      previousHash =
        block.block_hash;


      expectedBlockIndex += 1;
    }


    return {

      valid:
        brokenBlocks.length === 0,

      brokenBlocks,

      totalBlocks:
        result.rows.length
    };


  } catch (err) {

    console.error(
      '[ERROR] verifyChain:',
      err.message
    );

    throw err;
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  registerOnBlockchain,

  verifyChain,

  computeBlockHash

};