import { useState } from 'react';
import { verifyDocumentFile } from '../api/verifyApi';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';

function VerifyPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setResult(null);
    if (!file) { setError('Choose a file to verify.'); return; }
    setIsSubmitting(true);
    try {
      const data = await verifyDocumentFile(file);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Verify a document</h1>
            <p>Upload a file to check it against its registered SHA-256 hash.</p>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="content-card">
            <div className="content-card-body">
              <form onSubmit={handleSubmit} className="upload-form">
                <div className="form-group full-width">
                  <label>File to verify</label>
                  <input className="file-input" type="file" onChange={(e) => setFile(e.target.files[0])} required />
                </div>
                {error && <div className="error-message">{error}</div>}
                <button className="upload-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying...' : 'Verify document'}
                </button>
              </form>
            </div>
          </div>

          {result && (
            <div className="content-card">
              <div className="content-card-body">
                <h2 style={{ marginBottom: '14px' }}>
                  {result.result === 'authentic' && '✅ Authentic'}
                  {result.result === 'tampered' && '❌ Tampered — file does not match the registered version'}
                  {result.result === 'unknown' && '⚠️ No matching document found in the system'}
                </h2>
                <p><strong>Uploaded file hash:</strong> <span style={{ fontFamily: 'monospace' }}>{result.uploadedHash}</span></p>
                {result.document && (
                  <>
                    <p><strong>Matched document:</strong> {result.document.title}</p>
                    <p><strong>Matched version:</strong> v{result.version.version_number}</p>
                    <p><strong>Registered hash:</strong> <span style={{ fontFamily: 'monospace' }}>{result.version.sha256_hash}</span></p>
                    
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default VerifyPage;