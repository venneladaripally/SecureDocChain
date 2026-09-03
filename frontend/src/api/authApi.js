import axiosClient from './axiosClient';


// ============================================================
// LOGIN
// ============================================================

export async function loginUser(
  username,
  password
) {
  const response = await axiosClient.post(
    '/api/auth/login',
    {
      username,
      password
    }
  );

  return response.data;
}


// ============================================================
// REGISTER
// ============================================================
//
// Creates a new viewer account.
//
// Body:
//
// {
//   fullName,
//   username,
//   email,
//   password,
//   securityQuestion,
//   securityAnswer
// }
//
// ============================================================

export async function registerUser(
  fullName,
  username,
  email,
  password,
  securityQuestion,
  securityAnswer
) {
  const response = await axiosClient.post(
    '/api/auth/register',
    {
      fullName,
      username,
      email,
      password,
      securityQuestion,
      securityAnswer
    }
  );

  return response.data;
}


// ============================================================
// CURRENT USER
// ============================================================
//
// GET /api/users/me
//
// Used by AuthContext when the application starts.
// ============================================================

export async function fetchCurrentUser() {
  const response = await axiosClient.get(
    '/api/users/me'
  );

  return response.data;
}


// ============================================================
// LOGOUT
// ============================================================
//
// POST /api/auth/logout
// ============================================================

export async function logoutUser() {
  const response = await axiosClient.post(
    '/api/auth/logout'
  );

  return response.data;
}


// ============================================================
// SET / UPDATE SECURITY QUESTION
// ============================================================
//
// PUT /api/users/me/security-question
//
// Body:
//
// {
//   securityQuestion,
//   securityAnswer
// }
//
// ============================================================

export async function setSecurityQuestion(
  securityQuestion,
  securityAnswer
) {
  const response = await axiosClient.put(
    '/api/users/me/security-question',
    {
      securityQuestion,
      securityAnswer
    }
  );

  return response.data;
}


// ============================================================
// CHANGE PASSWORD
// ============================================================
//
// PUT /api/users/me/password
//
// Body:
//
// {
//   currentPassword,
//   securityAnswer,
//   newPassword
// }
//
// ============================================================

export async function changePassword(
  currentPassword,
  securityAnswer,
  newPassword
) {
  const response = await axiosClient.put(
    '/api/users/me/password',
    {
      currentPassword,
      securityAnswer,
      newPassword
    }
  );

  return response.data;
}
// ============================================================
// PASSWORD RECOVERY
// ============================================================

export async function getPasswordRecoveryQuestion(identifier) {
  const response = await axiosClient.post(
    '/api/auth/forgot-password/question',
    { identifier }
  );

  return response.data;
}

export async function resetPasswordWithSecurityQuestion(
  identifier,
  securityAnswer,
  newPassword
) {
  const response = await axiosClient.post(
    '/api/auth/forgot-password/reset',
    {
      identifier,
      securityAnswer,
      newPassword
    }
  );

  return response.data;
}
