const bcrypt = require('bcryptjs');

const pool = require('../config/database');

const {
  verifyChain
} = require('../utils/blockchainUtils');

const {
  logAction
} = require('../utils/auditLogger');


const SALT_ROUNDS = 10;

const VALID_ROLES = [
  'admin',
  'engineer',
  'reviewer',
  'auditor',
  'viewer'
];


// ============================================================
// HELPERS
// ============================================================

function parseUserId(value) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}


function cleanString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}


function isValidEmail(email) {
  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailPattern.test(email);
}


// ============================================================
// POST /api/admin/users
//
// Create a user with an administrator-selected role.
// The account starts without a recovery question; on first login
// the user must configure their own security question and answer.
//
// Body:
//
// {
//   "fullName": "...",
//   "username": "...",
//   "email": "...",
//   "password": "...",
//   "role": "engineer"
// }
// ============================================================

async function createUser(req, res) {

  const fullName =
    cleanString(req.body.fullName);

  const username =
    cleanString(req.body.username);

  const email =
    cleanString(req.body.email).toLowerCase();

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : '';

  const role =
    cleanString(req.body.role).toLowerCase();


  // ----------------------------------------------------------
  // Required fields
  // ----------------------------------------------------------

  if (
    !fullName ||
    !username ||
    !email ||
    !password ||
    !role
  ) {
    return res.status(400).json({
      success: false,
      message:
        'fullName, username, email, password, and role are all required'
    });
  }


  // ----------------------------------------------------------
  // Basic validation
  // ----------------------------------------------------------

  if (fullName.length > 150) {
    return res.status(400).json({
      success: false,
      message:
        'Full name must not exceed 150 characters'
    });
  }

  if (username.length > 50) {
    return res.status(400).json({
      success: false,
      message:
        'Username must not exceed 50 characters'
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message:
        'Invalid email format'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message:
        'Password must be at least 8 characters long'
    });
  }

  if (password.length > 128) {
    return res.status(400).json({
      success: false,
      message:
        'Password must not exceed 128 characters'
    });
  }


  // ----------------------------------------------------------
  // Role validation
  // ----------------------------------------------------------

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message:
        `Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`
    });
  }


  try {

    // --------------------------------------------------------
    // Find requested role
    // --------------------------------------------------------

    const roleResult =
      await pool.query(
        `SELECT id, name
         FROM roles
         WHERE name = $1
         LIMIT 1`,
        [role]
      );

    if (
      roleResult.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Role "${role}" does not exist in the database`
      });
    }


    // --------------------------------------------------------
    // Check username/email
    // --------------------------------------------------------

    const existing =
      await pool.query(
        `SELECT id
         FROM users
         WHERE username = $1
            OR email = $2
         LIMIT 1`,
        [
          username,
          email
        ]
      );

    if (
      existing.rows.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Username or email already in use'
      });
    }


    // --------------------------------------------------------
    // Hash password
    // --------------------------------------------------------

    const passwordHash =
      await bcrypt.hash(
        password,
        SALT_ROUNDS
      );


    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    const insertResult =
      await pool.query(
        `INSERT INTO users (
           full_name,
           username,
           email,
           password_hash,
           role_id
         )

         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5
         )

         RETURNING
           id,
           full_name,
           username,
           email,
           role_id,
           is_active,
           created_at`,
        [
          fullName,
          username,
          email,
          passwordHash,
          roleResult.rows[0].id
        ]
      );


    const createdUser =
      insertResult.rows[0];


    // --------------------------------------------------------
    // Audit
    // --------------------------------------------------------

    await logAction({
      userId:
        req.user.userId,

      action:
        'USER_CREATED',

      entityType:
        'user',

      entityId:
        createdUser.id,

      details: {
        createdUser:
          createdUser.username,

        role
      },

      req
    });


    return res.status(201).json({
      success: true,

      message:
        'User created successfully',

      user:
        createdUser
    });

  } catch (err) {

    console.error(
      '[ERROR] createUser:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'User creation failed due to a server error'
    });
  }
}


// ============================================================
// GET /api/admin/users?search=
//
// List users.
// ============================================================

async function listUsers(req, res) {

  try {

    const search =
      cleanString(req.query.search);

    const conditions = [];
    const values = [];


    if (search) {

      values.push(
        `%${search}%`
      );

      conditions.push(
        `(u.username ILIKE $${values.length}
          OR u.full_name ILIKE $${values.length}
          OR u.email ILIKE $${values.length})`
      );
    }


    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';


    const result =
      await pool.query(
        `SELECT
           u.id,
           u.full_name,
           u.username,
           u.email,
           u.is_active,
           u.created_at,
           u.updated_at,
           r.id AS role_id,
           r.name AS role_name

         FROM users u

         JOIN roles r
           ON u.role_id = r.id

         ${whereClause}

         ORDER BY u.created_at DESC`,
        values
      );


    return res.status(200).json({
      success: true,
      count:
        result.rows.length,
      users:
        result.rows
    });

  } catch (err) {

    console.error(
      '[ERROR] listUsers:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to list users'
    });
  }
}


// ============================================================
// GET /api/admin/users/:id
//
// User details + recent activity.
// ============================================================

async function getUserDetail(req, res) {

  try {

    const userId =
      parseUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid user ID'
      });
    }


    // --------------------------------------------------------
    // User
    // --------------------------------------------------------

    const userResult =
      await pool.query(
        `SELECT
           u.id,
           u.full_name,
           u.username,
           u.email,
           u.is_active,
           u.created_at,
           u.updated_at,
           r.id AS role_id,
           r.name AS role_name

         FROM users u

         JOIN roles r
           ON u.role_id = r.id

         WHERE u.id = $1

         LIMIT 1`,
        [userId]
      );


    if (
      userResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }


    // --------------------------------------------------------
    // Recent activity
    // --------------------------------------------------------

    const activityResult =
      await pool.query(
        `SELECT
           a.id,
           a.user_id,
           a.action,
           a.entity_type,
           a.entity_id,
           a.details,
           a.ip_address,
           a.created_at

         FROM audit_logs a

         WHERE a.user_id = $1

         ORDER BY a.created_at DESC

         LIMIT 50`,
        [userId]
      );


    return res.json({
      success: true,

      user:
        userResult.rows[0],

      recentActivity:
        activityResult.rows
    });

  } catch (err) {

    console.error(
      '[ERROR] getUserDetail:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch user detail'
    });
  }
}


// ============================================================
// PATCH /api/admin/users/:id/role
//
// Body:
//
// {
//   "role": "engineer"
// }
// ============================================================

async function changeUserRole(req, res) {

  const client =
    await pool.connect();

  try {

    const userId =
      parseUserId(req.params.id);

    const role =
      cleanString(
        req.body.role
      ).toLowerCase();


    if (!userId) {

      return res.status(400).json({
        success: false,
        message:
          'Invalid user ID'
      });
    }


    if (!VALID_ROLES.includes(role)) {

      return res.status(400).json({
        success: false,
        message:
          `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }


    await client.query(
      'BEGIN'
    );


    // --------------------------------------------------------
    // Lock target user
    // --------------------------------------------------------

    const userResult =
      await client.query(
        `SELECT
           u.id,
           u.username,
           r.name AS current_role

         FROM users u

         JOIN roles r
           ON u.role_id = r.id

         WHERE u.id = $1

         FOR UPDATE`,
        [userId]
      );


    if (
      userResult.rows.length === 0
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }


    const targetUser =
      userResult.rows[0];


    // --------------------------------------------------------
    // Don't perform unnecessary role change.
    // --------------------------------------------------------

    if (
      targetUser.current_role === role
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        success: false,
        message:
          `User already has the "${role}" role`
      });
    }


    // --------------------------------------------------------
    // Find new role.
    // --------------------------------------------------------

    const roleResult =
      await client.query(
        `SELECT id
         FROM roles
         WHERE name = $1
         LIMIT 1`,
        [role]
      );


    if (
      roleResult.rows.length === 0
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        success: false,
        message:
          `Role "${role}" does not exist in the database`
      });
    }


    // --------------------------------------------------------
    // Update role.
    // --------------------------------------------------------

    await client.query(
      `UPDATE users

       SET role_id = $1,
           updated_at = NOW()

       WHERE id = $2`,
      [
        roleResult.rows[0].id,
        userId
      ]
    );


    await client.query(
      'COMMIT'
    );


    // --------------------------------------------------------
    // Audit
    // --------------------------------------------------------

    await logAction({
      userId:
        req.user.userId,

      action:
        'ROLE_CHANGE',

      entityType:
        'user',

      entityId:
        userId,

      details: {
        username:
          targetUser.username,

        previousRole:
          targetUser.current_role,

        newRole:
          role
      },

      req
    });


    return res.json({
      success: true,

      message:
        `Role updated to ${role}`,

      previousRole:
        targetUser.current_role,

      newRole:
        role
    });

  } catch (err) {

    try {
      await client.query(
        'ROLLBACK'
      );
    } catch (rollbackError) {
      console.error(
        '[ERROR] Role rollback failed:',
        rollbackError.message
      );
    }

    console.error(
      '[ERROR] changeUserRole:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to change role'
    });

  } finally {

    client.release();
  }
}


// ============================================================
// PATCH /api/admin/users/:id/status
//
// Body:
//
// {
//   "isActive": true
// }
//
// or
//
// {
//   "isActive": false
// }
// ============================================================

async function setUserStatus(req, res) {

  const client =
    await pool.connect();

  try {

    const userId =
      parseUserId(req.params.id);

    const {
      isActive
    } = req.body;


    if (!userId) {

      return res.status(400).json({
        success: false,
        message:
          'Invalid user ID'
      });
    }


    // --------------------------------------------------------
    // isActive must actually be boolean.
    // --------------------------------------------------------

    if (
      typeof isActive !== 'boolean'
    ) {

      return res.status(400).json({
        success: false,
        message:
          'isActive must be a boolean'
      });
    }


    // --------------------------------------------------------
    // Prevent self-deactivation.
    // --------------------------------------------------------

    if (
      userId ===
      Number(req.user.userId)
      &&
      isActive === false
    ) {

      return res.status(400).json({
        success: false,
        message:
          'You cannot deactivate your own account'
      });
    }


    await client.query(
      'BEGIN'
    );


    // --------------------------------------------------------
    // Lock target user.
    // --------------------------------------------------------

    const userResult =
      await client.query(
        `SELECT
           id,
           username,
           is_active

         FROM users

         WHERE id = $1

         FOR UPDATE`,
        [userId]
      );


    if (
      userResult.rows.length === 0
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }


    const targetUser =
      userResult.rows[0];


    // --------------------------------------------------------
    // No-op status change.
    // --------------------------------------------------------

    if (
      targetUser.is_active ===
      isActive
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        success: false,
        message:
          `User is already ${
            isActive
              ? 'active'
              : 'deactivated'
          }`
      });
    }


    // --------------------------------------------------------
    // Update status.
    // --------------------------------------------------------

    await client.query(
      `UPDATE users

       SET is_active = $1,
           updated_at = NOW()

       WHERE id = $2`,
      [
        isActive,
        userId
      ]
    );


    await client.query(
      'COMMIT'
    );


    // --------------------------------------------------------
    // Audit
    // --------------------------------------------------------

    await logAction({
      userId:
        req.user.userId,

      action:
        isActive
          ? 'USER_ACTIVATED'
          : 'USER_DEACTIVATED',

      entityType:
        'user',

      entityId:
        userId,

      details: {
        username:
          targetUser.username,

        previousStatus:
          targetUser.is_active,

        newStatus:
          isActive
      },

      req
    });


    return res.json({
      success: true,

      message:
        `User ${
          isActive
            ? 'activated'
            : 'deactivated'
        }`,

      isActive
    });

  } catch (err) {

    try {
      await client.query(
        'ROLLBACK'
      );
    } catch (rollbackError) {
      console.error(
        '[ERROR] Status rollback failed:',
        rollbackError.message
      );
    }

    console.error(
      '[ERROR] setUserStatus:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to update user status'
    });

  } finally {

    client.release();
  }
}


// ============================================================
// GET /api/admin/dashboard
//
// Administrative dashboard statistics.
// ============================================================

async function getDashboardStats(req, res) {

  try {

    // --------------------------------------------------------
    // User count
    // --------------------------------------------------------

    const totalUsers =
      await pool.query(
        `SELECT COUNT(*)
         FROM users`
      );


    // --------------------------------------------------------
    // Document count
    // --------------------------------------------------------

    const totalDocuments =
      await pool.query(
        `SELECT COUNT(*)
         FROM documents
         WHERE is_deleted = FALSE`
      );


    // --------------------------------------------------------
    // Pending documents
    // --------------------------------------------------------

    const pendingDocuments =
      await pool.query(
        `SELECT COUNT(*)
         FROM documents
         WHERE status = 'pending_review'
           AND is_deleted = FALSE`
      );


    // --------------------------------------------------------
    // Verification breakdown
    // --------------------------------------------------------

    const verificationBreakdown =
      await pool.query(
        `
        SELECT
          result,
          COUNT(*) AS count

        FROM (
          SELECT DISTINCT ON (entity_id)
            entity_id,
            details->>'result' AS result

          FROM audit_logs

          WHERE action = 'VERIFY'
            AND entity_type = 'document'
            AND entity_id IS NOT NULL

          ORDER BY
            entity_id,
            created_at DESC
        ) latest

        GROUP BY result
        `
      );


    const verified =
      verificationBreakdown.rows.find(
        (row) =>
          row.result === 'authentic'
      )?.count || 0;


    const tampered =
      verificationBreakdown.rows.find(
        (row) =>
          row.result === 'tampered'
      )?.count || 0;


    // --------------------------------------------------------
    // Blockchain count
    // --------------------------------------------------------

    const totalBlocks =
      await pool.query(
        `SELECT COUNT(*)
         FROM blockchain_transactions`
      );


    // --------------------------------------------------------
    // Verify blockchain chain.
    // --------------------------------------------------------

    const chain =
      await verifyChain();


    // --------------------------------------------------------
    // Recent activity
    // --------------------------------------------------------

    const recentActivity =
      await pool.query(
        `SELECT
           a.id,
           a.user_id,
           a.action,
           a.entity_type,
           a.entity_id,
           a.details,
           a.ip_address,
           a.created_at,
           u.username

         FROM audit_logs a

         LEFT JOIN users u
           ON a.user_id = u.id

         ORDER BY a.created_at DESC

         LIMIT 15`
      );


    return res.json({
      success: true,

      stats: {

        totalUsers:
          Number(
            totalUsers.rows[0].count
          ),

        totalDocuments:
          Number(
            totalDocuments.rows[0].count
          ),

        pendingDocuments:
          Number(
            pendingDocuments.rows[0].count
          ),

        verifiedDocuments:
          Number(verified),

        tamperedDocuments:
          Number(tampered),

        blockchain: {

          totalBlocks:
            Number(
              totalBlocks.rows[0].count
            ),

          chainValid:
            Boolean(
              chain?.valid
            )
        }
      },

      recentActivity:
        recentActivity.rows
    });

  } catch (err) {

    console.error(
      '[ERROR] getDashboardStats:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load dashboard'
    });
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createUser,
  listUsers,
  getUserDetail,
  changeUserRole,
  setUserStatus,
  getDashboardStats
};