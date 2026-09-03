const { verifyToken } = require('../utils/jwtUtils');


// ============================================================
// AUTHENTICATION MIDDLEWARE
//
// Runs before protected routes.
//
// Responsibilities:
// 1. Read JWT from Authorization header.
// 2. Validate the JWT.
// 3. Validate the important claims.
// 4. Validate the user's role.
// 5. Attach trusted user information to req.user.
// ============================================================


// ============================================================
// VALID APPLICATION ROLES
// ============================================================
//
// IMPORTANT:
// viewer MUST be included.
//
// Public registration creates users with the "viewer" role.
// ============================================================

const ALLOWED_ROLES = [
  'admin',
  'engineer',
  'reviewer',
  'auditor',
  'viewer'
];


// ============================================================
// REQUIRE AUTHENTICATION
// ============================================================

function requireAuth(req, res, next) {

  try {

    // ----------------------------------------------------------
    // Read Authorization header
    // ----------------------------------------------------------

    const authHeader =
      req.headers.authorization;


    // ----------------------------------------------------------
    // Authorization header must exist.
    // ----------------------------------------------------------

    if (!authHeader) {

      return res.status(401).json({

        success: false,

        message:
          'No authentication token provided'

      });

    }


    // ----------------------------------------------------------
    // Authorization header must use Bearer scheme.
    // ----------------------------------------------------------

    if (
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid authentication header'

      });

    }


    // ----------------------------------------------------------
    // Extract JWT.
    // ----------------------------------------------------------

    const token =
      authHeader.slice(7).trim();


    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          'No authentication token provided'

      });

    }


    // ----------------------------------------------------------
    // Verify JWT.
    //
    // verifyToken() checks:
    //
    // - JWT signature
    // - JWT expiration
    // - JWT structure
    // ----------------------------------------------------------

    const decoded =
      verifyToken(token);


    // ----------------------------------------------------------
    // Validate decoded payload.
    //
    // Expected:
    //
    // {
    //   userId,
    //   username,
    //   role
    // }
    // ----------------------------------------------------------

    if (
      !decoded ||
      decoded.userId === undefined ||
      decoded.userId === null ||
      !decoded.username ||
      !decoded.role
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid authentication token'

      });

    }


    // ----------------------------------------------------------
    // Normalize user ID.
    // ----------------------------------------------------------

    const userId =
      Number(decoded.userId);


    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid user information in token'

      });

    }


    // ----------------------------------------------------------
    // Validate username.
    // ----------------------------------------------------------

    if (
      typeof decoded.username !== 'string' ||
      !decoded.username.trim()
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid username in authentication token'

      });

    }


    // ----------------------------------------------------------
    // Normalize role.
    //
    // This prevents unnecessary problems if a role is stored
    // with different capitalization.
    // ----------------------------------------------------------

    const role =
      String(decoded.role)
        .trim()
        .toLowerCase();


    // ----------------------------------------------------------
    // Validate role.
    //
    // viewer is intentionally included.
    // ----------------------------------------------------------

    if (
      !ALLOWED_ROLES.includes(role)
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid role in authentication token'

      });

    }


    // ----------------------------------------------------------
    // Attach trusted authentication information.
    //
    // Controllers and RBAC middleware use:
    //
    // req.user.userId
    // req.user.username
    // req.user.role
    // ----------------------------------------------------------

    req.user = {

      userId,

      username:
        decoded.username.trim(),

      role

    };


    // ----------------------------------------------------------
    // Authentication successful.
    // ----------------------------------------------------------

    return next();

  } catch (err) {

    // ----------------------------------------------------------
    // JWT verification failed.
    //
    // Possible reasons:
    //
    // - expired token
    // - invalid signature
    // - malformed token
    // - invalid JWT
    // ----------------------------------------------------------

    console.error(
      '[AUTH] Token verification failed:',
      err.message
    );


    return res.status(401).json({

      success: false,

      message:
        'Invalid or expired token'

    });

  }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  requireAuth
};