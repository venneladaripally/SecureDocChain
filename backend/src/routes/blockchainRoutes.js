const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getDocumentBlockchain, verifyChainIntegrity, blockchainStats } = require('../controllers/blockchainController');

router.get('/document/:id', requireAuth, getDocumentBlockchain);
router.get('/verify-chain', requireAuth, verifyChainIntegrity);
router.get('/stats', requireAuth, blockchainStats);

module.exports = router;