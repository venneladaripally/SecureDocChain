const pool = require('../config/database');


// ============================================================
// AUDIT LOGGER
// ============================================================
//
// Writes security-sensitive actions to the audit_logs table.
//
// IMPORTANT:
// Audit logging should NEVER cause the main application request
// to fail. Therefore, database errors are caught and logged
// instead of being thrown back to the controller.
//
// Supported fields:
//
// userId
// action
// entityType
// entityId
// details
// req
//
// Example:
//
// await logAction({
//   userId: req.user.userId,
//   action: 'LOGIN',
//   entityType: 'user',
//   entityId: req.user.userId,
//   details: {
//     username: req.user.username
//   },
//   req
// });
// ============================================================


async function logAction({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
  req = null
}) {

  try {

    // ----------------------------------------------------------
    // Validate required action
    // ----------------------------------------------------------

    if (
      typeof action !== 'string' ||
      !action.trim()
    ) {

      console.error(
        '[ERROR] Audit log action is required'
      );

      return;
    }


    // ----------------------------------------------------------
    // Get client IP address
    // ----------------------------------------------------------
    //
    // req.ip is preferred because Express can normalize the
    // address.
    //
    // x-forwarded-for is useful when the application is behind
    // a reverse proxy/load balancer.
    // ----------------------------------------------------------

    let ipAddress = null;


    if (req) {

      const forwardedFor =
        req.headers?.['x-forwarded-for'];


      if (forwardedFor) {

        // x-forwarded-for can contain:
        //
        // client, proxy1, proxy2
        //
        // The first address is normally the original client.
        ipAddress =
          String(
            forwardedFor
          )
          .split(',')[0]
          .trim();

      } else {

        ipAddress =
          req.ip ||
          req.socket?.remoteAddress ||
          null;

      }

    }


    // ----------------------------------------------------------
    // Normalize details
    // ----------------------------------------------------------
    //
    // PostgreSQL JSONB accepts a JSON string.
    //
    // If details is missing, store an empty object.
    // ----------------------------------------------------------

    let auditDetails = {};


    if (
      details !== null &&
      details !== undefined
    ) {

      if (
        typeof details === 'object'
      ) {

        auditDetails =
          details;

      } else {

        auditDetails = {
          value:
            String(details)
        };

      }

    }


    // ----------------------------------------------------------
    // Write audit record
    // ----------------------------------------------------------

    await pool.query(

      `INSERT INTO audit_logs (
         user_id,
         action,
         entity_type,
         entity_id,
         details,
         ip_address
       )

       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6
       )`,

      [

        userId || null,

        action.trim(),

        entityType
          ? String(entityType).trim()
          : null,

        entityId || null,

        JSON.stringify(
          auditDetails
        ),

        ipAddress
          ? String(ipAddress).slice(0, 64)
          : null

      ]

    );


  } catch (err) {

    // ----------------------------------------------------------
    // IMPORTANT:
    //
    // Never allow an audit-log failure to break the main
    // application request.
    // ----------------------------------------------------------

    console.error(
      '[ERROR] Failed to write audit log:',
      err.message
    );

  }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  logAction
};