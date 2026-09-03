import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, roles, allowWithoutSecurityQuestion = false }) {
  const { token, loading, user } = useAuth();

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '80px' }}>Loading...</p>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role || user?.role_name;

  if (
    !allowWithoutSecurityQuestion &&
    user &&
    user.securityQuestionConfigured === false
  ) {
    return <Navigate to="/security-question-setup" replace />;
  }
  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;