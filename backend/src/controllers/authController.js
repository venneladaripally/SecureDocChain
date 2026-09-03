const bcrypt = require('bcryptjs');

const pool = require('../config/database');

const { generateToken } = require('../utils/jwtUtils');

const SALT_ROUNDS = 10;

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was the name of your first school?',
  'What is the name of the city where you were born?',
  'What was your childhood nickname?',
  'What is your favorite childhood memory?'
];

function normalizeSecurityAnswer(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


// ============================================================
// HELPERS
// ============================================================

function cleanString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}


// ============================================================
// POST /api/auth/register
//
// Public registration.
//
// Every self-registered user starts as:
//
// viewer
//
// Higher-privilege roles must be assigned through
// admin-controlled functionality.
// ============================================================

async function register(req, res) {
  const fullName =
    cleanString(req.body.fullName);

  const username =
    cleanString(req.body.username);

  const email =
    cleanString(req.body.email)
      .toLowerCase();

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : '';

  // ----------------------------------------------------------
  // Basic validation
  // ----------------------------------------------------------

  if (
    !fullName ||
    !username ||
    !email ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message:
        'fullName, username, email, and password are all required'
    });
  }

  // ----------------------------------------------------------
  // Name validation
  // ----------------------------------------------------------

  if (fullName.length < 2) {
    return res.status(400).json({
      success: false,
      message:
        'Full name must contain at least 2 characters'
    });
  }

  if (fullName.length > 100) {
    return res.status(400).json({
      success: false,
      message:
        'Full name must not exceed 100 characters'
    });
  }

  // ----------------------------------------------------------
  // Username validation
  //
  // Allows:
  // letters
  // numbers
  // underscore
  // dot
  // hyphen
  // ----------------------------------------------------------

  if (
    username.length < 3 ||
    username.length > 50
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Username must be between 3 and 50 characters'
    });
  }

  const usernamePattern =
    /^[A-Za-z0-9_.-]+$/;

  if (
    !usernamePattern.test(username)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Username contains invalid characters'
    });
  }

  // ----------------------------------------------------------
  // Email validation
  // ----------------------------------------------------------

  if (email.length > 255) {
    return res.status(400).json({
      success: false,
      message:
        'Email address is too long'
    });
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailPattern.test(email)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Invalid email format'
    });
  }

  // ----------------------------------------------------------
  // Password validation
  // ----------------------------------------------------------

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

  const securityQuestion = cleanString(req.body.securityQuestion);
  const securityAnswer = cleanString(req.body.securityAnswer);

  if (!securityQuestion || !securityAnswer) {
    return res.status(400).json({
      success: false,
      message: 'Security question and security answer are required'
    });
  }

  if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid security question'
    });
  }

  if (securityAnswer.length < 2 || securityAnswer.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Security answer must be between 2 and 255 characters'
    });
  }

  try {

    // --------------------------------------------------------
    // Check existing username/email.
    // --------------------------------------------------------

    const existing =
      await pool.query(
        `SELECT
           id,
           username,
           email
         FROM users
         WHERE LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($2)
         LIMIT 1`,
        [
          username,
          email
        ]
      );

    if (
      existing.rows.length > 0
    ) {
      const existingUser =
        existing.rows[0];

      if (
        existingUser.username
          ?.toLowerCase() ===
        username.toLowerCase()
      ) {
        return res.status(409).json({
          success: false,
          message:
            'Username already in use'
        });
      }

      return res.status(409).json({
        success: false,
        message:
          'Email already in use'
      });
    }

    // --------------------------------------------------------
    // Get default viewer role.
    // --------------------------------------------------------

    const roleResult =
      await pool.query(
        `SELECT
           id,
           name
         FROM roles
         WHERE name = $1`,
        ['viewer']
      );

    if (
      roleResult.rows.length === 0
    ) {
      console.error(
        '[ERROR] Default viewer role not found'
      );

      return res.status(500).json({
        success: false,
        message:
          'Default role configuration is missing'
      });
    }

    const viewerRoleId =
      roleResult.rows[0].id;

    // --------------------------------------------------------
    // Hash password.
    // --------------------------------------------------------

    const passwordHash =
      await bcrypt.hash(
        password,
        SALT_ROUNDS
      );

    const securityAnswerHash =
      await bcrypt.hash(
        normalizeSecurityAnswer(securityAnswer),
        SALT_ROUNDS
      );

    // --------------------------------------------------------
    // Create user.
    //
    // Role is ALWAYS viewer for public registration.
    // The client cannot choose a privileged role.
    // --------------------------------------------------------

    const insertResult =
      await pool.query(
        `INSERT INTO users (
           full_name,
           username,
           email,
           password_hash,
           security_question,
           security_answer_hash,
           role_id
         )

         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7
         )

         RETURNING
           id,
           full_name,
           username,
           email,
           role_id,
           created_at`,
        [
          fullName,
          username,
          email,
          passwordHash,
          securityQuestion,
          securityAnswerHash,
          viewerRoleId
        ]
      );

    const newUser =
      insertResult.rows[0];

    console.log(
      `[INFO] User registered: ${username}`
    );

    return res.status(201).json({
      success: true,

      message:
        'User registered successfully',

      user: newUser
    });

  } catch (err) {

    // --------------------------------------------------------
    // PostgreSQL unique constraint handling.
    //
    // This protects against two registration requests arriving
    // at almost exactly the same time.
    // --------------------------------------------------------

    if (
      err.code === '23505'
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Username or email already in use'
      });
    }

    console.error(
      '[ERROR] Registration failed:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Registration failed due to a server error'
    });
  }
}


// ============================================================
// POST /api/auth/login
//
// Authenticates a user and returns a JWT.
//
// JWT contains:
//
// userId
// username
// role
//
// The role comes from the database, never from the frontend.
// ============================================================

async function login(req, res) {
  const username =
    cleanString(req.body.username);

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : '';

  // ----------------------------------------------------------
  // Validate input.
  // ----------------------------------------------------------

  if (
    !username ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message:
        'username and password are required'
    });
  }

  try {

    // --------------------------------------------------------
    // Get user + role.
    // --------------------------------------------------------

    const result =
      await pool.query(
        `SELECT
  u.id,
  u.full_name,
  u.username,
  u.email,
  u.password_hash,
  u.is_active,
  u.security_question,
  u.security_answer_hash,

  r.id AS role_id,
  r.name AS role_name

         FROM users u

         JOIN roles r
           ON u.role_id = r.id

         WHERE LOWER(u.username) = LOWER($1)

         LIMIT 1`,
        [username]
      );

    // --------------------------------------------------------
    // Don't reveal whether username or password is wrong.
    // --------------------------------------------------------

    if (
      result.rows.length === 0
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid username or password'
      });
    }

    const user =
      result.rows[0];

    // --------------------------------------------------------
    // Check account status.
    // --------------------------------------------------------

    if (
      !user.is_active
    ) {
      return res.status(403).json({
        success: false,
        message:
          'This account has been deactivated'
      });
    }

    // --------------------------------------------------------
    // Verify password.
    // --------------------------------------------------------

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (
      !passwordMatches
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid username or password'
      });
    }

    // --------------------------------------------------------
    // Generate JWT.
    //
    // generateToken() gets role_name directly from the
    // database result.
    // --------------------------------------------------------

    const token =
      generateToken(user);

    console.log(
      `[INFO] User logged in: ${user.username}`
    );

    // --------------------------------------------------------
    // Return safe user information.
    //
    // NEVER return password_hash.
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        'Login successful',

      token,

      user: {
        id: user.id,
        fullName:
          user.full_name,
        username:
          user.username,
        email:
          user.email,
        role:
          user.role_name,
        securityQuestionConfigured:
          Boolean(user.security_question && user.security_answer_hash)
      }
    });

  } catch (err) {

    console.error(
      '[ERROR] Login failed:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Login failed due to a server error'
    });
  }
}


// ============================================================
// POST /api/auth/forgot-password/question
//
// Returns the configured security question for an account.
// No password or security-answer hash is ever returned.
// ============================================================

async function getPasswordRecoveryQuestion(req, res) {
  const identifier = cleanString(req.body.identifier).toLowerCase();

  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: 'Username or email is required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, security_question, is_active
       FROM users
       WHERE LOWER(username) = $1 OR LOWER(email) = $1
       LIMIT 1`,
      [identifier]
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].is_active ||
      !result.rows[0].security_question
    ) {
      return res.status(404).json({
        success: false,
        message: 'No password recovery security question is configured for this account'
      });
    }

    return res.status(200).json({
      success: true,
      securityQuestion: result.rows[0].security_question
    });
  } catch (err) {
    console.error('[ERROR] Password recovery question lookup failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to start password recovery'
    });
  }
}


// ============================================================
// POST /api/auth/forgot-password/reset
//
// The security answer is verified on the server before the new
// password is accepted. This endpoint does not require a JWT.
// ============================================================

async function resetPasswordWithSecurityQuestion(req, res) {
  const identifier = cleanString(req.body.identifier).toLowerCase();
  const securityAnswer = cleanString(req.body.securityAnswer);
  const newPassword = typeof req.body.newPassword === 'string'
    ? req.body.newPassword
    : '';

  if (!identifier || !securityAnswer || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Username or email, security answer, and new password are required'
    });
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'New password must be between 8 and 128 characters'
    });
  }

  if (securityAnswer.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Security answer is too long'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, password_hash, security_question, security_answer_hash, is_active
       FROM users
       WHERE LOWER(username) = $1 OR LOWER(email) = $1
       LIMIT 1`,
      [identifier]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Unable to verify password recovery details'
      });
    }

    const user = result.rows[0];

    if (!user.security_question || !user.security_answer_hash) {
      return res.status(409).json({
        success: false,
        message: 'No password recovery security question is configured for this account'
      });
    }

    const answerMatches = await bcrypt.compare(
      normalizeSecurityAnswer(securityAnswer),
      user.security_answer_hash
    );

    if (!answerMatches) {
      return res.status(401).json({
        success: false,
        message: 'Security answer is incorrect. Password was not changed.'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const updateResult = await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = TRUE
       RETURNING id`,
      [newPasswordHash, user.id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Password could not be changed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('[ERROR] Password reset failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed due to a server error'
    });
  }
}


// ============================================================
// POST /api/auth/logout
//
// JWT authentication is stateless, so the server does not
// need to destroy the token.
//
// The frontend removes the token from localStorage.
//
// This endpoint exists to provide a clean API logout action.
// ============================================================

async function logout(req, res) {
  console.log(
    `[INFO] User logged out: ${
      req.user?.username || 'unknown'
    }`
  );

  return res.status(200).json({
    success: true,
    message:
      'Logout successful'
  });
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  register,
  login,
  logout,
  getPasswordRecoveryQuestion,
  resetPasswordWithSecurityQuestion
};