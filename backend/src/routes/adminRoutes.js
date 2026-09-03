const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createUser, listUsers, getUserDetail, changeUserRole, setUserStatus, getDashboardStats
} = require('../controllers/adminController');

router.use(requireAuth, requireRole('admin'));

router.post('/users', createUser);
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/role', changeUserRole);
router.patch('/users/:id/status', setUserStatus);
router.get('/dashboard', getDashboardStats);

module.exports = router;