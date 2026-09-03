const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { listAuditLogs, documentAuditTrail } = require('../controllers/auditController');

router.get('/', requireAuth, requireRole('admin', 'auditor'), listAuditLogs);
router.get('/document/:id', requireAuth, requireRole('admin', 'auditor'), documentAuditTrail);

module.exports = router;