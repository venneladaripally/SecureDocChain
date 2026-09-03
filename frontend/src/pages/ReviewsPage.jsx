import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchPendingReviews } from '../api/reviewApi';
import Sidebar from '../components/Sidebar';

function ReviewsPage() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPendingReviews()
      .then((data) => setDocuments(data.documents))
      .catch(() => setError('Failed to load pending reviews.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Reviews</h1>
            <p>Documents awaiting your review.</p>
          </div>
        </header>
        <div className="dashboard-content">
          {error && <div className="error-message">{error}</div>}
          <div className="content-card">
            <div className="content-card-body">
              {isLoading ? <p>Loading...</p> : (
                <table className="document-table">
                  <thead><tr><th>Document</th><th>Uploaded by</th><th>Updated</th><th>Action</th></tr></thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.title}</td>
                        <td>{doc.uploaded_by_username}</td>
                        <td>{new Date(doc.updated_at).toLocaleString()}</td>
                        <td><Link to={`/documents/${doc.id}`} className="download-button">Review</Link></td>
                      </tr>
                    ))}
                    {documents.length === 0 && <tr><td colSpan="4">Nothing awaiting review.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ReviewsPage;