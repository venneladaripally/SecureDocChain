import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import ReviewsPage from './pages/ReviewsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UserManagementPage from './pages/UserManagementPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProfilePage from './pages/ProfilePage';
import SecurityQuestionSetupPage from './pages/SecurityQuestionSetupPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            path="/security-question-setup"
            element={
              <ProtectedRoute allowWithoutSecurityQuestion>
                <SecurityQuestionSetupPage />
              </ProtectedRoute>
            }
          />

          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetailPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="/reviews" element={<ProtectedRoute roles={['admin', 'reviewer']}><ReviewsPage /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute roles={['admin', 'auditor']}><AuditLogsPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UserManagementPage /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;