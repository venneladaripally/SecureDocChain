import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await loginUser(username, password);
      login(data.token, data.user);
      if (data.user?.securityQuestionConfigured === false) {
        navigate('/security-question-setup');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      // err.response is axios's shape for a non-2xx response.
      // Fall back to a generic message if the server didn't send one.
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
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
          Secure documents.
          <br />
          <span>Trusted records.</span>
        </h2>

        <p>
          A secure document version-control and audit platform
          designed for traceability, integrity, and controlled access.
        </p>
      </div>

      <div className="security-points">
        <div className="security-point">JWT Authentication</div>
        <div className="security-point">Role-Based Access</div>
        <div className="security-point">Document Integrity</div>
      </div>
    </div>

    <div className="auth-form-side">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1>Welcome back</h1>
          <p>Sign in to access your SecureDocChain workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              className="form-input"
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              className="form-input"
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="forgot-password-link">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  </div>
);
}

export default LoginPage;