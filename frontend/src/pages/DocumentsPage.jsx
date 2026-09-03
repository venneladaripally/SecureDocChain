import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchDocuments } from '../api/documentApi';
import { fetchSharedWithMe } from '../api/shareApi';
import Sidebar from '../components/Sidebar';
import DocumentList from '../components/DocumentList';
import UploadForm from '../components/UploadForm';

const UPLOAD_ROLES = ['admin', 'engineer'];

function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [view, setView] = useState('mine'); // 'mine' | 'shared'
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const canUpload = user && UPLOAD_ROLES.includes(user.role || user.role_name);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (view === 'shared') {
        const data = await fetchSharedWithMe();
        setDocuments(data.documents);
      } else {
        const params = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (category) params.category = category;
        const data = await fetchDocuments(params);
        setDocuments(data.documents);
      }
    } catch (err) {
      setError('Failed to load documents.');
    } finally {
      setIsLoading(false);
    }
  }, [view, search, status, category]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Documents</h1>
            <p>Search, filter, and manage documents.</p>
          </div>
        </header>

        <div className="dashboard-content">
          {canUpload && (
            <div className="content-card">
              <div className="content-card-header">
                <div><h2>Upload document</h2><p>Add a new document (creates Version 1).</p></div>
              </div>
              <div className="content-card-body">
                <UploadForm onUploadSuccess={loadDocuments} />
              </div>
            </div>
          )}

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Documents</h2>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className={view === 'mine' ? 'primary-button' : 'download-button'} style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setView('mine')}>My documents</button>
                  <button className={view === 'shared' ? 'primary-button' : 'download-button'} style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setView('shared')}>Shared with me</button>
                </div>
              </div>
            </div>

            {view === 'mine' && (
              <div className="content-card-body" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input className="form-input" placeholder="Search title/description" value={search}
                  onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '240px' }} />
                <input className="form-input" placeholder="Category" value={category}
                  onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: '160px' }} />
                <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: '180px' }}>
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="content-card-body">
              {isLoading ? <p>Loading documents...</p> : (
                <DocumentList documents={documents} onDownloadError={setError} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DocumentsPage;