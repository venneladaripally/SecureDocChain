import { useState, useEffect } from 'react';
import { fetchBlockchainStats, verifyChain } from '../api/blockchainApi';
import Sidebar from '../components/Sidebar';

function BlockchainPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchBlockchainStats().then(setStats).catch(() => setError('Failed to load blockchain stats.'));
  }, []);

  async function handleVerify() {
    setChecking(true);
    try {
      const data = await verifyChain();
      setStats((prev) => ({ ...prev, chainValid: data.valid, brokenBlocks: data.brokenBlocks }));
    } catch (err) {
      setError('Chain verification failed.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Blockchain</h1>
            <p>Status of the local, hash-chained ledger used to register document versions.</p>
          </div>
        </header>
        <div className="dashboard-content">
          {error && <div className="error-message">{error}</div>}
          {stats && (
            <div className="content-card">
              <div className="content-card-body">
                <p><strong>Total blocks:</strong> {stats.totalBlocks}</p>
                <p><strong>Confirmed blocks:</strong> {stats.confirmedBlocks}</p>
                <p><strong>Chain valid:</strong> {stats.chainValid ? '✅ Yes' : '❌ No — tampering detected'}</p>
                {stats.brokenBlocks?.length > 0 && <p><strong>Broken block IDs:</strong> {stats.brokenBlocks.join(', ')}</p>}
                <button className="upload-button" style={{ width: 'auto', padding: '10px 20px', marginTop: '10px' }} onClick={handleVerify} disabled={checking}>
                  {checking ? 'Verifying...' : 'Re-verify chain now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default BlockchainPage;