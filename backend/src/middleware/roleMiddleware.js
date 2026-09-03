// ============================================================
// ROLE-BASED ACCESS CONTROL MIDDLEWARE
// ============================================================
//
// This middleware must run AFTER requireAuth.
//
// requireAuth attaches:
//
// req.user = {
//   userId,
//   username,
//   role
// }
//
// This middleware checks whether the authenticated user's role
// is allowed to access the requested route.
//
// Example:
//
// router.post(
//   '/users',
//   requireAuth,
//   requireRole('admin'),
//   createUser
// );
//
// Multiple roles are supported:
//
// requireRole('admin', 'auditor')
//
// ============================================================


function requireRole(...allowedRoles) {

  return (req, res, next) => {

    // ----------------------------------------------------------
    // Authentication must already have happened.
    // ----------------------------------------------------------

    if (
      !req.user ||
      !req.user.userId ||
      !req.user.role
    ) {

      return res.status(401).json({

        success: false,

        message:
          'No authenticated user found'

      });
    }


    // ----------------------------------------------------------
    // Make sure the route was configured with at least one role.
    // ----------------------------------------------------------

    if (
      allowedRoles.length === 0
    ) {

      console.error(
        '[ERROR] requireRole was used without allowed roles'
      );

      return res.status(500).json({

        success: false,

        message:
          'Role authorization is not configured correctly'

      });
    }


    // ----------------------------------------------------------
    // Normalize roles.
    //
    // This prevents accidental failures caused by:
    //
    // Admin
    // ADMIN
    // admin
    //
    // The database/JWT normally contains lowercase roles,
    // but normalization makes the middleware safer.
    // ----------------------------------------------------------

    const userRole =
      String(req.user.role)
        .trim()
        .toLowerCase();


    const normalizedAllowedRoles =
      allowedRoles.map(
        (role) =>
          String(role)
            .trim()
            .toLowerCase()
      );


    // ----------------------------------------------------------
    // Check authorization.
    // ----------------------------------------------------------

    if (
      !normalizedAllowedRoles.includes(
        userRole
      )
    ) {

      console.warn(
        `[WARN] Access denied for user ${req.user.username || req.user.userId}. ` +
        `Role: ${userRole}. ` +
        `Required: ${normalizedAllowedRoles.join(', ')}`
      );


      return res.status(403).json({

        success: false,

        message:
          `Access denied: requires one of [${normalizedAllowedRoles.join(', ')}]`

      });
    }


    // ----------------------------------------------------------
    // User is authorized.
    // ----------------------------------------------------------

    next();

  };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  requireRole
};