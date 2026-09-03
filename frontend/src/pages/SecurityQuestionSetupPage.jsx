import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSecurityQuestion } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was the name of your first school?',
  'What is the name of the city where you were born?',
  'What was your childhood nickname?',
  'What is your favorite childhood memory?'
];

function SecurityQuestionSetupPage() {
  const [securityQuestion, setSecurityQuestionState] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!securityQuestion || securityAnswer.trim().length < 2) {
      setError('Please select a question and provide an answer of at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setSecurityQuestion(securityQuestion, securityAnswer.trim());
      updateUser({
        securityQuestion,
        securityQuestionConfigured: true
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to save your security question. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-logo">Secure<span>Doc</span>Chain</div>
        <div className="brand-content">
          <h2>Protect your<br /><span>account recovery.</span></h2>
          <p>
            Your administrator created your account. Before you continue,
            choose a personal security question and answer.
          </p>
        </div>
        <div className="security-points">
          <div className="security-point">Required for recovery</div>
          <div className="security-point">Answer is hashed</div>
          <div className="security-point">Works for every role</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h1>Set security question</h1>
            <p>
              Hi {user?.fullName || user?.username}. This is required before
              you can access SecureDocChain.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="securityQuestion">Security question</label>
              <select
                className="form-input"
                id="securityQuestion"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestionState(e.target.value)}
                required
              >
                <option value="">Select a question</option>
                {SECURITY_QUESTIONS.map((question) => (
                  <option key={question} value={question}>{question}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="securityAnswer">Your answer</label>
              <input
                className="form-input"
                id="securityAnswer"
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Enter an answer you will remember"
                autoComplete="off"
                minLength={2}
                maxLength={255}
                required
              />
            </div>

            <p className="form-help">
              You will need this answer to reset your password if you forget it.
            </p>

            {error && <div className="error-message">{error}</div>}

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save and continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SecurityQuestionSetupPage;
