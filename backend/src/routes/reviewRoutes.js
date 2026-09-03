const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { listPendingReviews } = require('../controllers/reviewController');

router.get('/pending', requireAuth, requireRole('admin', 'reviewer'), listPendingReviews);

module.exports = router;