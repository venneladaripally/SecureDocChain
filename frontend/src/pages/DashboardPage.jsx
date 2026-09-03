import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchDocuments } from '../api/documentApi';
import Sidebar from '../components/Sidebar';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents);
    } catch (err) {
      setError('Failed to load documents.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const pendingCount = documents.filter((d) => d.status === 'pending_review').length;
  const approvedCount = documents.filter((d) => d.status === 'approved').length;

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Document Workspace</h1>
            <p>Manage and verify your organization's documents.</p>
          </div>
          <div className="user-area">
            <div className="user-info">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role || user?.role_name}</div>
            </div>
            <div className="avatar">{user?.username?.charAt(0).toUpperCase()}</div>
            <button className="logout-button" onClick={handleLogout}>Log out</button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">TOTAL DOCUMENTS</div>
              <div className="stat-value">{documents.length}</div>
              <div className="stat-description">Documents in workspace</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">PENDING REVIEW</div>
              <div className="stat-value">{pendingCount}</div>
              <div className="stat-description">Awaiting reviewer action</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">APPROVED</div>
              <div className="stat-value">{approvedCount}</div>
              <div className="stat-description">Passed review</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">ACCESS LEVEL</div>
              <div className="stat-value" style={{ fontSize: '22px' }}>{user?.role || user?.role_name}</div>
              <div className="stat-description">Current account role</div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Recent documents</h2>
                <p>Latest files in the workspace.</p>
              </div>
              <Link to="/documents" className="primary-button" style={{ display: 'inline-block', width: 'auto', padding: '10px 18px' }}>
                View all documents
              </Link>
            </div>
            <div className="content-card-body">
              {isLoading ? <p>Loading documents...</p> : (
                <ul style={{ listStyle: 'none' }}>
                  {documents.slice(0, 5).map((doc) => (
                    <li key={doc.id} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f6' }}>
                      <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                      <span style={{ marginLeft: '10px', color: '#667085', fontSize: '13px' }}>{doc.status}</span>
                    </li>
                  ))}
                  {documents.length === 0 && <p style={{ color: '#667085' }}>No documents yet.</p>}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;