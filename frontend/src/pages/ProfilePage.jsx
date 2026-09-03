import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';

import {
  changePassword,
  fetchCurrentUser,
  setSecurityQuestion
} from '../api/authApi';

import Sidebar from '../components/Sidebar';


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


function ProfilePage() {

  const { user } = useAuth();


  // ==========================================================
  // PROFILE
  // ==========================================================

  const [profileUser, setProfileUser] =
    useState(user || null);


  // ==========================================================
  // SECURITY QUESTION
  // ==========================================================

  const [securityQuestion, setSecurityQuestionState] =
    useState('');

  const [securityAnswer, setSecurityAnswer] =
    useState('');

  const [securityLoading, setSecurityLoading] =
    useState(false);

  const [securityError, setSecurityError] =
    useState('');

  const [securityMessage, setSecurityMessage] =
    useState('');


  // ==========================================================
  // CHANGE PASSWORD
  // ==========================================================

  const [currentPassword, setCurrentPassword] =
    useState('');

  const [passwordSecurityAnswer, setPasswordSecurityAnswer] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState('');

  const [passwordMessage, setPasswordMessage] =
    useState('');


  // ==========================================================
  // LOAD CURRENT USER
  // ==========================================================

  useEffect(() => {

    async function loadProfile() {

      try {

        const data =
          await fetchCurrentUser();


        if (data?.user) {

          setProfileUser(
            data.user
          );


          setSecurityQuestionState(
            data.user.securityQuestion ||
            data.user.security_question ||
            ''
          );

        }

      } catch (err) {

        console.error(
          '[PROFILE] Failed to load profile:',
          err.message
        );

      }

    }


    loadProfile();

  }, []);


  // ==========================================================
  // SET / UPDATE SECURITY QUESTION
  // ==========================================================

  async function handleSecurityQuestionSubmit(e) {

    e.preventDefault();

    setSecurityError('');
    setSecurityMessage('');


    const question =
      securityQuestion.trim();

    const answer =
      securityAnswer.trim();


    // --------------------------------------------------------
    // Validate question
    // --------------------------------------------------------

    if (!question) {

      setSecurityError(
        'Please select a security question.'
      );

      return;

    }


    if (
      !SECURITY_QUESTIONS.includes(
        question
      )
    ) {

      setSecurityError(
        'Please select a valid security question.'
      );

      return;

    }


    // --------------------------------------------------------
    // Validate answer
    // --------------------------------------------------------

    if (!answer) {

      setSecurityError(
        'Security answer is required.'
      );

      return;

    }


    if (answer.length < 2) {

      setSecurityError(
        'Security answer must be at least 2 characters long.'
      );

      return;

    }


    if (answer.length > 255) {

      setSecurityError(
        'Security answer must not exceed 255 characters.'
      );

      return;

    }


    setSecurityLoading(true);


    try {

      const data =
        await setSecurityQuestion(
          question,
          answer
        );


      setSecurityMessage(
        data?.message ||
        'Security question updated successfully.'
      );


      // ------------------------------------------------------
      // Clear answer immediately.
      // ------------------------------------------------------

      setSecurityAnswer('');


      // ------------------------------------------------------
      // Update local profile state.
      // ------------------------------------------------------

      setProfileUser(
        (previous) => ({
          ...(previous || {}),
          securityQuestion:
            question
        })
      );


      setSecurityQuestionState(
        question
      );

    } catch (err) {

      setSecurityError(
        err.response?.data?.message ||
        'Failed to update security question.'
      );

    } finally {

      setSecurityLoading(false);

    }

  }


  // ==========================================================
  // CHANGE PASSWORD
  // ==========================================================

  async function handlePasswordSubmit(e) {

    e.preventDefault();

    setPasswordError('');
    setPasswordMessage('');


    // --------------------------------------------------------
    // Make sure security question exists.
    // --------------------------------------------------------

    const configuredQuestion =
      profileUser?.securityQuestion ||
      profileUser?.security_question ||
      securityQuestion;


    if (!configuredQuestion) {

      setPasswordError(
        'Please set your security question before changing your password.'
      );

      return;

    }


    // --------------------------------------------------------
    // Validate current password
    // --------------------------------------------------------

    if (!currentPassword) {

      setPasswordError(
        'Current password is required.'
      );

      return;

    }


    // --------------------------------------------------------
    // Validate security answer
    // --------------------------------------------------------

    if (!passwordSecurityAnswer.trim()) {

      setPasswordError(
        'Security answer is required.'
      );

      return;

    }


    // --------------------------------------------------------
    // Validate new password
    // --------------------------------------------------------

    if (newPassword.length < 8) {

      setPasswordError(
        'New password must be at least 8 characters long.'
      );

      return;

    }


    if (newPassword.length > 128) {

      setPasswordError(
        'New password must not exceed 128 characters.'
      );

      return;

    }


    // --------------------------------------------------------
    // Confirm new password
    // --------------------------------------------------------

    if (
      newPassword !==
      confirmPassword
    ) {

      setPasswordError(
        'New password and confirm password do not match.'
      );

      return;

    }


    // --------------------------------------------------------
    // New password must be different.
    // --------------------------------------------------------

    if (
      currentPassword ===
      newPassword
    ) {

      setPasswordError(
        'New password must be different from your current password.'
      );

      return;

    }


    setPasswordLoading(true);


    try {

      const data =
        await changePassword(
          currentPassword,
          passwordSecurityAnswer,
          newPassword
        );


      setPasswordMessage(
        data?.message ||
        'Password changed successfully.'
      );


      // ------------------------------------------------------
      // Clear all sensitive fields.
      // ------------------------------------------------------

      setCurrentPassword('');

      setPasswordSecurityAnswer('');

      setNewPassword('');

      setConfirmPassword('');

    } catch (err) {

      setPasswordError(
        err.response?.data?.message ||
        'Failed to change password.'
      );

    } finally {

      setPasswordLoading(false);

    }

  }


  // ==========================================================
  // DISPLAY VALUES
  // ==========================================================

  const displayFullName =
    profileUser?.fullName ||
    profileUser?.full_name ||
    '';


  const displayUsername =
    profileUser?.username ||
    '';


  const displayEmail =
    profileUser?.email ||
    '';


  const displayRole =
    profileUser?.role ||
    profileUser?.role_name ||
    '';


  const currentSecurityQuestion =
    profileUser?.securityQuestion ||
    profileUser?.security_question ||
    securityQuestion ||
    '';


  const hasSecurityQuestion =
    Boolean(
      currentSecurityQuestion
    );


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="dashboard">

      <Sidebar />


      <main className="dashboard-main">


        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="dashboard-header">

          <div className="dashboard-title">

            <h1>
              Profile
            </h1>

            <p>
              Manage your account and security settings.
            </p>

          </div>

        </header>


        <div className="dashboard-content">


          {/* ================================================== */}
          {/* ACCOUNT DETAILS */}
          {/* ================================================== */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Account details
                </h2>

              </div>

            </div>


            <div className="content-card-body">

              <p>
                <strong>
                  Full name:
                </strong>{' '}
                {displayFullName}
              </p>


              <p>
                <strong>
                  Username:
                </strong>{' '}
                {displayUsername}
              </p>


              <p>
                <strong>
                  Email:
                </strong>{' '}
                {displayEmail}
              </p>


              <p>
                <strong>
                  Role:
                </strong>{' '}
                {displayRole}
              </p>

            </div>

          </div>


          {/* ================================================== */}
          {/* SECURITY QUESTION */}
          {/* ================================================== */}
{!hasSecurityQuestion && (
  
          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Security question
                </h2>

                <p>
                  Set a security question and answer.
                  The answer is securely hashed and never
                  stored as plain text.
                </p>

              </div>

            </div>


            <div className="content-card-body">


              {securityError && (

                <div className="error-message">

                  {securityError}

                </div>

              )}


              {securityMessage && (

                <div className="success-message">

                  {securityMessage}

                </div>

              )}


              <form
                onSubmit={
                  handleSecurityQuestionSubmit
                }
                className="upload-form"
              >


                {/* SECURITY QUESTION */}

                <div className="form-group">

                  <label htmlFor="securityQuestion">

                    Security question

                  </label>


                  <select
                    id="securityQuestion"
                    className="form-input"
                    value={
                      securityQuestion
                    }
                    onChange={(e) =>
                      setSecurityQuestionState(
                        e.target.value
                      )
                    }
                    required
                  >

                    <option value="">

                      Select a security question

                    </option>


                    {SECURITY_QUESTIONS.map(
                      (question) => (

                        <option
                          key={question}
                          value={question}
                        >

                          {question}

                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* SECURITY ANSWER */}

                <div className="form-group">

                  <label htmlFor="securityAnswer">

                    Security answer

                  </label>


                  <input
                    id="securityAnswer"
                    className="form-input"
                    type="password"
                    value={
                      securityAnswer
                    }
                    onChange={(e) =>
                      setSecurityAnswer(
                        e.target.value
                      )
                    }
                    maxLength={255}
                    autoComplete="off"
                    placeholder={
                      hasSecurityQuestion
                        ? 'Enter a new answer to update it'
                        : 'Enter your answer'
                    }
                    required
                  />

                </div>


                {/* SAVE BUTTON */}

                <button
                  className="upload-button"
                  type="submit"
                  disabled={
                    securityLoading
                  }
                >

                  {securityLoading
                    ? 'Saving...'
                    : hasSecurityQuestion
                      ? 'Update security question'
                      : 'Set security question'}

                </button>


              </form>

            </div>

          </div>
)}

          {/* ================================================== */}
          {/* CHANGE PASSWORD */}
          {/* ================================================== */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Change password
                </h2>

                <p>
                  Your current password and security answer
                  are required to change your password.
                </p>

              </div>

            </div>


            <div className="content-card-body">


              {passwordError && (

                <div className="error-message">

                  {passwordError}

                </div>

              )}


              {passwordMessage && (

                <div className="success-message">

                  {passwordMessage}

                </div>

              )}


              {!hasSecurityQuestion && (

                <div className="error-message">

                  Please set your security question above
                  before changing your password.

                </div>

              )}


              {hasSecurityQuestion && (

                <form
                  onSubmit={
                    handlePasswordSubmit
                  }
                  className="upload-form"
                >


                  {/* CURRENT PASSWORD */}

                  <div className="form-group">

                    <label htmlFor="currentPassword">

                      Current password

                    </label>


                    <input
                      id="currentPassword"
                      className="form-input"
                      type="password"
                      value={
                        currentPassword
                      }
                      onChange={(e) =>
                        setCurrentPassword(
                          e.target.value
                        )
                      }
                      autoComplete="current-password"
                      required
                    />

                  </div>


                  {/* CURRENT SECURITY QUESTION */}

                  <div className="form-group">

                    <label htmlFor="currentSecurityQuestion">

                      Security question

                    </label>


                    <input
                      id="currentSecurityQuestion"
                      className="form-input"
                      type="text"
                      value={
                        currentSecurityQuestion
                      }
                      readOnly
                    />

                  </div>


                  {/* SECURITY ANSWER */}

                  <div className="form-group">

                    <label htmlFor="passwordSecurityAnswer">

                      Security answer

                    </label>


                    <input
                      id="passwordSecurityAnswer"
                      className="form-input"
                      type="password"
                      value={
                        passwordSecurityAnswer
                      }
                      onChange={(e) =>
                        setPasswordSecurityAnswer(
                          e.target.value
                        )
                      }
                      autoComplete="off"
                      placeholder="Enter your security answer"
                      required
                    />

                  </div>


                  {/* NEW PASSWORD */}

                  <div className="form-group">

                    <label htmlFor="newPassword">

                      New password

                    </label>


                    <input
                      id="newPassword"
                      className="form-input"
                      type="password"
                      value={
                        newPassword
                      }
                      onChange={(e) =>
                        setNewPassword(
                          e.target.value
                        )
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      required
                    />

                  </div>


                  {/* CONFIRM PASSWORD */}

                  <div className="form-group">

                    <label htmlFor="confirmPassword">

                      Confirm new password

                    </label>


                    <input
                      id="confirmPassword"
                      className="form-input"
                      type="password"
                      value={
                        confirmPassword
                      }
                      onChange={(e) =>
                        setConfirmPassword(
                          e.target.value
                        )
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Re-enter your new password"
                      required
                    />

                  </div>


                  {/* CHANGE PASSWORD BUTTON */}

                  <button
                    className="upload-button"
                    type="submit"
                    disabled={
                      passwordLoading
                    }
                  >

                    {passwordLoading
                      ? 'Changing...'
                      : 'Change password'}

                  </button>


                </form>

              )}

            </div>

          </div>


        </div>

      </main>

    </div>

  );

}


export default ProfilePage;