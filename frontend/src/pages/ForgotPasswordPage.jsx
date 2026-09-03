import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getPasswordRecoveryQuestion,
  resetPasswordWithSecurityQuestion
} from '../api/authApi';

function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleFindQuestion(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const data = await getPasswordRecoveryQuestion(identifier);
      setSecurityQuestion(data.securityQuestion);
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to find your security question. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await resetPasswordWithSecurityQuestion(
        identifier,
        securityAnswer,
        newPassword
      );
      setSuccess(data.message);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Password reset failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-logo">
          Secure<span>Doc</span>Chain
        </div>
        <div className="brand-content">
          <h2>
            Recover your
            <br />
            <span>secure account.</span>
          </h2>
          <p>
            Your security question protects password recovery without
            exposing your stored security answer.
          </p>
        </div>
        <div className="security-points">
          <div className="security-point">Verified Recovery</div>
          <div className="security-point">Hashed Answers</div>
          <div className="security-point">Protected Passwords</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h1>Forgot password?</h1>
            <p>
              {step === 1
                ? 'Enter your username or email to retrieve your security question.'
                : 'Answer your security question to create a new password.'}
            </p>
          </div>

          {success ? (
            <div className="success-message">{success}</div>
          ) : step === 1 ? (
            <form className="auth-form" onSubmit={handleFindQuestion}>
              <div className="form-group">
                <label htmlFor="identifier">Username or email</label>
                <input
                  className="form-input"
                  id="identifier"
                  type="text"
                  placeholder="Enter your username or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Checking...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Security question</label>
                <div className="security-question-display">
                  {securityQuestion}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="securityAnswer">Your answer</label>
                <input
                  className="form-input"
                  id="securityAnswer"
                  type="text"
                  placeholder="Enter your security answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New password</label>
                <input
                  className="form-input"
                  id="newPassword"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input
                  className="form-input"
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Resetting password...' : 'Reset password'}
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setStep(1);
                  setSecurityQuestion('');
                  setSecurityAnswer('');
                  setError('');
                }}
              >
                Use a different account
              </button>
            </form>
          )}

          <div className="auth-footer">
            Remember your password? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
