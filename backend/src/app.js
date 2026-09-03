const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

require('dotenv').config();


// ============================================================
// ROUTES
// ============================================================

const healthRoutes =
  require('./routes/healthRoutes');

const authRoutes =
  require('./routes/authRoutes');

const userRoutes =
  require('./routes/userRoutes');

const adminRoutes =
  require('./routes/adminRoutes');

const documentRoutes =
  require('./routes/documentRoutes');

const verifyRoutes =
  require('./routes/verifyRoutes');

const blockchainRoutes =
  require('./routes/blockchainRoutes');

const shareRoutes =
  require('./routes/shareRoutes');

const reviewRoutes =
  require('./routes/reviewRoutes');

const auditRoutes =
  require('./routes/auditRoutes');


// ============================================================
// MIDDLEWARE
// ============================================================

const {
  apiLimiter
} = require('./middleware/rateLimiter');


// ============================================================
// APPLICATION
// ============================================================

const app =
  express();


// ============================================================
// SECURITY HEADERS
// ============================================================

app.use(
  helmet()
);


// ============================================================
// CORS
// ============================================================
//
// In production, FRONTEND_URL should be explicitly configured.
//
// Example:
//
// FRONTEND_URL=http://localhost:5173
//
// We avoid combining wildcard origin with credentials.
// ============================================================

const frontendUrl =
  process.env.FRONTEND_URL;

if (frontendUrl) {

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true
    })
  );

} else {

  // Development fallback.
  //
  // Since authentication is JWT-based and the frontend sends
  // the token through Authorization headers, credentials are
  // not required for normal authentication.
  app.use(
    cors()
  );
}


// ============================================================
// REQUEST BODY PARSING
// ============================================================
//
// Limit JSON requests so a malicious client cannot send
// arbitrarily large JSON payloads.
//
// File uploads use multer separately.
// ============================================================

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb'
  })
);


// ============================================================
// GLOBAL API RATE LIMITER
// ============================================================
//
// Applies to all /api routes.
//
// Authentication routes additionally use authLimiter.
// ============================================================

app.use(
  '/api',
  apiLimiter
);


// ============================================================
// HEALTH
// ============================================================

app.use(
  '/health',
  healthRoutes
);


// ============================================================
// AUTHENTICATION
// ============================================================

app.use(
  '/api/auth',
  authRoutes
);


// ============================================================
// USERS
// ============================================================

app.use(
  '/api/users',
  userRoutes
);


// ============================================================
// ADMIN / RBAC MANAGEMENT
// ============================================================

app.use(
  '/api/admin',
  adminRoutes
);


// ============================================================
// DOCUMENTS
// ============================================================

app.use(
  '/api/documents',
  documentRoutes
);


// ============================================================
// DOCUMENT VERIFICATION
// ============================================================

app.use(
  '/api/verify',
  verifyRoutes
);


// ============================================================
// BLOCKCHAIN
// ============================================================

app.use(
  '/api/blockchain',
  blockchainRoutes
);


// ============================================================
// SHARING
// ============================================================

app.use(
  '/api/shares',
  shareRoutes
);


// ============================================================
// REVIEWS
// ============================================================

app.use(
  '/api/reviews',
  reviewRoutes
);


// ============================================================
// AUDIT LOGS
// ============================================================

app.use(
  '/api/audit-logs',
  auditRoutes
);


// ============================================================
// 404 HANDLER
// ============================================================

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
);


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
//
// This catches errors that are passed through Express's
// error-handling mechanism.
//
// Do not expose stack traces to clients.
// ============================================================

app.use(
  (err, req, res, next) => {

    console.error(
      '[ERROR] Unhandled application error:',
      err.message
    );

    if (res.headersSent) {
      return next(err);
    }

    return res.status(500).json({
      success: false,
      message:
        'Internal server error'
    });
  }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = app;