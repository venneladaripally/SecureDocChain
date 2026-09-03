const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /health
// Purpose: confirm the API server is running AND can reach PostgreSQL.
// This is the very first thing we test after starting the server.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.status(200).json({
      success: true,
      message: 'SecureDocChain backend is running',
      database: 'connected',
      serverTime: result.rows[0].current_time
    });
  } catch (err) {
    console.error('[ERROR] Health check database query failed:', err);
    res.status(500).json({
      success: false,
      message: 'Backend is running but database connection failed',
      error: err.message || err.code || String(err)
    });
  }
});

module.exports = router;