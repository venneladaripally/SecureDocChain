const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const {
  logAction
} = require('../utils/auditLogger');

const SALT_ROUNDS = 10;


// ============================================================
// SECURITY QUESTIONS
// ============================================================

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was the name of your first school?',
  'What is the name of the city where you were born?',
  'What was your childhood nickname?',
  'What is your favorite childhood memory?'
];


// ============================================================
// HELPERS
// ============================================================

function isValidUserId(value) {
  const userId = Number(value);

  return (
    Number.isInteger(userId) &&
    userId > 0
  );
}


function cleanString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}


// ============================================================
// NORMALIZE SECURITY ANSWER
// ============================================================
//
// Makes these answers equivalent:
//
// "Fluffy"
// " fluffy "
// "FLUFFY"
// "  Fluffy  "
//
// We do NOT store the original answer.
// Only the bcrypt hash is stored.
// ============================================================

function normalizeSecurityAnswer(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


// ============================================================
// GET /api/users/me
//
// Returns the currently authenticated user's information.
//
// Password hash and security-answer hash are NEVER returned.
// ============================================================

async function getCurrentUser(req, res) {

  try {

    const userId =
      Number(req.user.userId);


    if (!isValidUserId(userId)) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid authenticated user'
      });

    }


    const result =
      await pool.query(

        `SELECT
           u.id,
           u.full_name,
           u.username,
           u.email,
           u.is_active,
           u.created_at,
           u.security_question,

           r.id AS role_id,
           r.name AS role_name

         FROM users u

         JOIN roles r
           ON u.role_id = r.id

         WHERE u.id = $1

         LIMIT 1`,

        [userId]

      );


    if (result.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });

    }


    const user =
      result.rows[0];


    if (!user.is_active) {

      return res.status(403).json({
        success: false,
        message:
          'This account has been deactivated'
      });

    }


    return res.status(200).json({

      success: true,

      user: {

        id:
          user.id,

        fullName:
          user.full_name,

        username:
          user.username,

        email:
          user.email,

        role:
          user.role_name,

        roleId:
          user.role_id,

        isActive:
          user.is_active,

        securityQuestion:
          user.security_question || null,

        securityQuestionConfigured:
          Boolean(user.security_question),

        createdAt:
          user.created_at

      }

    });

  } catch (err) {

    console.error(
      '[ERROR] Fetching current user failed:',
      err.message
    );


    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch user details'
    });

  }

}


// ============================================================
// PUT /api/users/me/security-question
//
// Body:
//
// {
//   "securityQuestion": "...",
//   "securityAnswer": "..."
// }
//
// The answer is NEVER stored as plain text.
// It is stored as a bcrypt hash.
// ============================================================

async function setSecurityQuestion(req, res) {

  try {

    const userId =
      Number(req.user.userId);


    const securityQuestion =
      cleanString(
        req.body.securityQuestion
      );


    const securityAnswer =
      cleanString(
        req.body.securityAnswer
      );


    // ----------------------------------------------------------
    // Validate authenticated user
    // ----------------------------------------------------------

    if (!isValidUserId(userId)) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid authenticated user'
      });

    }


    // ----------------------------------------------------------
    // Validate security question
    // ----------------------------------------------------------

    if (!securityQuestion) {

      return res.status(400).json({
        success: false,
        message:
          'Security question is required'
      });

    }


    if (
      !SECURITY_QUESTIONS.includes(
        securityQuestion
      )
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Invalid security question'
      });

    }


    // ----------------------------------------------------------
    // Validate security answer
    // ----------------------------------------------------------

    if (!securityAnswer) {

      return res.status(400).json({
        success: false,
        message:
          'Security answer is required'
      });

    }


    if (securityAnswer.length < 2) {

      return res.status(400).json({
        success: false,
        message:
          'Security answer must be at least 2 characters long'
      });

    }


    if (securityAnswer.length > 255) {

      return res.status(400).json({
        success: false,
        message:
          'Security answer must not exceed 255 characters'
      });

    }


    // ----------------------------------------------------------
    // Verify user exists and is active
    // ----------------------------------------------------------

    const userResult =
  await pool.query(
    `SELECT
       id,
       is_active,
       security_question
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );


    if (userResult.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });

    }


    if (!userResult.rows[0].is_active) {

      return res.status(403).json({
        success: false,
        message:
          'This account has been deactivated'
      });

    }
    if (userResult.rows[0].security_question) {

  return res.status(409).json({
    success: false,
    message:
      'Security question is already configured and cannot be changed'
  });

}


    // ----------------------------------------------------------
    // Normalize answer
    // ----------------------------------------------------------

    const normalizedAnswer =
      normalizeSecurityAnswer(
        securityAnswer
      );


    // ----------------------------------------------------------
    // Hash security answer
    // ----------------------------------------------------------

    const securityAnswerHash =
      await bcrypt.hash(
        normalizedAnswer,
        SALT_ROUNDS
      );


    // ----------------------------------------------------------
    // Save security question and answer hash
    // ----------------------------------------------------------

    await pool.query(

      `UPDATE users

       SET
         security_question = $1,
         security_answer_hash = $2,
         updated_at = NOW()

       WHERE id = $3`,

      [
        securityQuestion,
        securityAnswerHash,
        userId
      ]

    );


    // ----------------------------------------------------------
    // Audit log
    //
    // NEVER log the security answer or its hash.
    // ----------------------------------------------------------

    await logAction({

      userId,

      action:
        'SECURITY_QUESTION_UPDATED',

      entityType:
        'user',

      entityId:
        userId,

      details: {
        questionUpdated: true
      },

      req

    });


    return res.status(200).json({

      success: true,

      message:
        'Security question updated successfully'

    });

  } catch (err) {

    console.error(
      '[ERROR] Security question update failed:',
      err.message
    );


    return res.status(500).json({

      success: false,

      message:
        'Failed to update security question'

    });

  }

}


// ============================================================
// PUT /api/users/me/password
//
// Body:
//
// {
//   "currentPassword": "...",
//   "securityAnswer": "...",
//   "newPassword": "..."
// }
//
// Requirements:
//
// 1. Current password must be correct.
// 2. Security question must be configured.
// 3. Security answer must be correct.
// 4. New password must be valid.
// ============================================================

async function changePassword(req, res) {

  const userId =
    Number(req.user.userId);


  const currentPassword =
    typeof req.body.currentPassword === 'string'
      ? req.body.currentPassword
      : '';


  const securityAnswer =
    cleanString(
      req.body.securityAnswer
    );


  const newPassword =
    typeof req.body.newPassword === 'string'
      ? req.body.newPassword
      : '';


  // ----------------------------------------------------------
  // Validate authenticated user
  // ----------------------------------------------------------

  if (!isValidUserId(userId)) {

    return res.status(401).json({
      success: false,
      message:
        'Invalid authenticated user'
    });

  }


  // ----------------------------------------------------------
  // Validate required fields
  // ----------------------------------------------------------

  if (
    !currentPassword ||
    !securityAnswer ||
    !newPassword
  ) {

    return res.status(400).json({

      success: false,

      message:
        'Current password, security answer, and new password are required'

    });

  }


  // ----------------------------------------------------------
  // Validate new password
  // ----------------------------------------------------------

  if (newPassword.length < 8) {

    return res.status(400).json({

      success: false,

      message:
        'New password must be at least 8 characters long'

    });

  }


  if (newPassword.length > 128) {

    return res.status(400).json({

      success: false,

      message:
        'New password must not exceed 128 characters'

    });

  }


  // ----------------------------------------------------------
  // New password must be different
  // ----------------------------------------------------------

  if (
    currentPassword === newPassword
  ) {

    return res.status(400).json({

      success: false,

      message:
        'New password must be different from current password'

    });

  }


  try {

    // --------------------------------------------------------
    // Get password + security information
    // --------------------------------------------------------

    const result =
      await pool.query(

        `SELECT
           id,
           password_hash,
           security_question,
           security_answer_hash,
           is_active

         FROM users

         WHERE id = $1

         LIMIT 1`,

        [userId]

      );


    if (result.rows.length === 0) {

      return res.status(404).json({

        success: false,

        message:
          'User not found'

      });

    }


    const user =
      result.rows[0];


    // --------------------------------------------------------
    // Account must be active
    // --------------------------------------------------------

    if (!user.is_active) {

      return res.status(403).json({

        success: false,

        message:
          'This account has been deactivated'

      });

    }


    // --------------------------------------------------------
    // Security question must be configured
    // --------------------------------------------------------

    if (
      !user.security_question ||
      !user.security_answer_hash
    ) {

      return res.status(409).json({

        success: false,

        message:
          'Please set your security question before changing your password'

      });

    }


    // --------------------------------------------------------
    // Verify current password
    // --------------------------------------------------------

    const passwordMatches =
      await bcrypt.compare(

        currentPassword,

        user.password_hash

      );


    if (!passwordMatches) {

      return res.status(401).json({

        success: false,

        message:
          'Current password is incorrect'

      });

    }


    // --------------------------------------------------------
    // Normalize security answer
    // --------------------------------------------------------

    const normalizedAnswer =
      normalizeSecurityAnswer(
        securityAnswer
      );


    // --------------------------------------------------------
    // Verify security answer
    // --------------------------------------------------------

    const securityAnswerMatches =
      await bcrypt.compare(

        normalizedAnswer,

        user.security_answer_hash

      );


    if (!securityAnswerMatches) {

      return res.status(401).json({

        success: false,

        message:
          'Security answer is incorrect'

      });

    }


    // --------------------------------------------------------
    // Hash new password
    // --------------------------------------------------------

    const newPasswordHash =
      await bcrypt.hash(

        newPassword,

        SALT_ROUNDS

      );


    // --------------------------------------------------------
    // Update password
    // --------------------------------------------------------

    const updateResult =
      await pool.query(

        `UPDATE users

         SET
           password_hash = $1,
           updated_at = NOW()

         WHERE id = $2
           AND is_active = TRUE

         RETURNING id`,

        [
          newPasswordHash,
          userId
        ]

      );


    if (
      updateResult.rows.length === 0
    ) {

      return res.status(409).json({

        success: false,

        message:
          'Password could not be changed'

      });

    }


    // --------------------------------------------------------
    // Audit log
    //
    // NEVER store:
    //
    // - current password
    // - new password
    // - security answer
    // - security answer hash
    // --------------------------------------------------------

    await logAction({

      userId,

      action:
        'PASSWORD_CHANGE',

      entityType:
        'user',

      entityId:
        userId,

      details: {

        changedBySelf:
          true,

        securityQuestionVerified:
          true

      },

      req

    });


    console.log(
      `[INFO] Password changed for user ID: ${userId}`
    );


    return res.status(200).json({

      success: true,

      message:
        'Password changed successfully'

    });

  } catch (err) {

    console.error(
      '[ERROR] Password change failed:',
      err.message
    );


    return res.status(500).json({

      success: false,

      message:
        'Failed to change password'

    });

  }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  getCurrentUser,

  setSecurityQuestion,

  changePassword

};