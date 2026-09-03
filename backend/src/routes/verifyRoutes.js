const express = require('express');
const router = express.Router();
const { uploadTemp } = require('../config/multerConfig');
const { requireAuth } = require('../middleware/authMiddleware');
const { verifyDocument } = require('../controllers/verifyController');
const { requireRole } = require('../middleware/roleMiddleware');
router.post(
  '/',
  requireAuth,
  requireRole('reviewer'),
  uploadTemp.single('file'),
  verifyDocument
);
module.exports = router;