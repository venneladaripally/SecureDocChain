import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/authApi';


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
// REGISTER PAGE
// ============================================================

function RegisterPage() {

  const [fullName, setFullName] =
    useState('');

  const [username, setUsername] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [securityQuestion, setSecurityQuestion] =
    useState('');

  const [securityAnswer, setSecurityAnswer] =
    useState('');

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);


  const navigate =
    useNavigate();


  // ==========================================================
  // SUBMIT REGISTRATION
  // ==========================================================

  async function handleSubmit(e) {

    e.preventDefault();

    setError('');

    setIsSubmitting(true);


    try {

      await registerUser(
        fullName,
        username,
        email,
        password,
        securityQuestion,
        securityAnswer
      );


      setSuccess(true);


      // Give the user time to see the success message.
      setTimeout(() => {
        navigate('/login');
      }, 1500);


    } catch (err) {

      const message =
        err.response?.data?.message ||
        'Registration failed. Please try again.';

      setError(message);


    } finally {

      setIsSubmitting(false);

    }

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="auth-page">

      {/* ======================================================
          LEFT BRAND SECTION
          ====================================================== */}

      <div className="auth-brand">

        <div className="brand-logo">
          Secure<span>Doc</span>Chain
        </div>


        <div className="brand-content">

          <h2>
            Build a safer
            <br />
            <span>document trail.</span>
          </h2>


          <p>
            Manage documents, control access, and maintain
            tamper-evident records across every version.
          </p>

        </div>


        <div className="security-points">

          <div className="security-point">
            Encrypted Storage
          </div>

          <div className="security-point">
            Audit Ready
          </div>

          <div className="security-point">
            Version Tracking
          </div>

        </div>

      </div>


      {/* ======================================================
          RIGHT FORM SECTION
          ====================================================== */}

      <div className="auth-form-side">

        <div className="auth-card">

          <div className="auth-card-header">

            <h1>
              Create account
            </h1>

            <p>
              Set up your SecureDocChain account.
            </p>

          </div>


          {/* ==================================================
              SUCCESS MESSAGE
              ================================================== */}

          {success ? (

            <div className="success-message">

              Account created successfully!
              Redirecting to login...

            </div>

          ) : (

            /* ================================================
               REGISTRATION FORM
               ================================================ */

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >

              {/* ==============================================
                  FULL NAME
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="fullName">
                  Full name
                </label>

                <input
                  className="form-input"
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  required
                  autoComplete="name"
                />

              </div>


              {/* ==============================================
                  USERNAME
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="username">
                  Username
                </label>

                <input
                  className="form-input"
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  required
                  autoComplete="username"
                />

              </div>


              {/* ==============================================
                  EMAIL
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="email">
                  Email
                </label>

                <input
                  className="form-input"
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                  autoComplete="email"
                />

              </div>


              {/* ==============================================
                  PASSWORD
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="password">
                  Password
                </label>

                <input
                  className="form-input"
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

              </div>


              {/* ==============================================
                  SECURITY QUESTION
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="securityQuestion">
                  Security question
                </label>

                <select
                  className="form-input"
                  id="securityQuestion"
                  value={securityQuestion}
                  onChange={(e) =>
                    setSecurityQuestion(e.target.value)
                  }
                  required
                >

                  <option
                    value=""
                    disabled
                  >
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


              {/* ==============================================
                  SECURITY ANSWER
                  ============================================== */}

              <div className="form-group">

                <label htmlFor="securityAnswer">
                  Security answer
                </label>

                <input
                  className="form-input"
                  id="securityAnswer"
                  type="text"
                  placeholder="Enter your answer"
                  value={securityAnswer}
                  onChange={(e) =>
                    setSecurityAnswer(e.target.value)
                  }
                  required
                  minLength={2}
                  autoComplete="off"
                />

                <small>
                  Remember this answer. You will need it
                  when changing your password.
                </small>

              </div>


              {/* ==============================================
                  ERROR
                  ============================================== */}

              {error && (

                <div className="error-message">
                  {error}
                </div>

              )}


              {/* ==============================================
                  SUBMIT
                  ============================================== */}

              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting}
              >

                {isSubmitting
                  ? 'Creating account...'
                  : 'Create account'}

              </button>

            </form>

          )}


          {/* ==================================================
              LOGIN LINK
              ================================================== */}

          <div className="auth-footer">

            Already have an account?{' '}

            <Link to="/login">
              Sign in
            </Link>

          </div>

        </div>

      </div>

    </div>

  );
}


export default RegisterPage;