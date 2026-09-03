const pool = require('../config/database');
const { verifyChain } = require('../utils/blockchainUtils');

// GET /api/blockchain/document/:id
async function getDocumentBlockchain(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT bt.*, v.version_number, u.username AS registered_by_username
       FROM blockchain_transactions bt
       JOIN document_versions v ON bt.version_id = v.id
       JOIN users u ON bt.registered_by = u.id
       WHERE bt.document_id = $1
       ORDER BY bt.block_index ASC`,
      [id]
    );
    res.json({ success: true, transactions: result.rows });
  } catch (err) {
    console.error('[ERROR] getDocumentBlockchain:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch blockchain records' });
  }
}

// GET /api/blockchain/verify-chain
async function verifyChainIntegrity(req, res) {
  try {
    const result = await verifyChain();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ERROR] verifyChainIntegrity:', err.message);
    res.status(500).json({ success: false, message: 'Failed to verify blockchain' });
  }
}

// GET /api/blockchain/stats
async function blockchainStats(req, res) {
  try {
    const totalResult = await pool.query(`SELECT COUNT(*) FROM blockchain_transactions`);
    const confirmedResult = await pool.query(`SELECT COUNT(*) FROM blockchain_transactions WHERE status = 'confirmed'`);
    const chain = await verifyChain();

    res.json({
      success: true,
      totalBlocks: Number(totalResult.rows[0].count),
      confirmedBlocks: Number(confirmedResult.rows[0].count),
      chainValid: chain.valid,
      brokenBlocks: chain.brokenBlocks
    });
  } catch (err) {
    console.error('[ERROR] blockchainStats:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch blockchain stats' });
  }
}

module.exports = { getDocumentBlockchain, verifyChainIntegrity, blockchainStats };