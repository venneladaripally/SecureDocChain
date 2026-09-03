import { useState, useEffect, useCallback } from 'react';
import { fetchAuditLogs } from '../api/auditApi';
import Sidebar from '../components/Sidebar';

const ACTIONS = [
  'REGISTRATION', 'LOGIN', 'LOGOUT', 'UPLOAD', 'VIEW', 'DOWNLOAD', 'EDIT', 'DELETE',
  'SHARE', 'REVOKE_SHARE', 'VERIFY', 'APPROVED', 'REJECTED', 'ROLE_CHANGE',
  'PASSWORD_CHANGE', 'VERSION_RESTORE'
];

function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = action ? { action } : {};
      const data = await fetchAuditLogs(params);
      setLogs(data.logs);
    } catch (err) {
      setError('Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Audit Logs</h1>
            <p>Full activity trail across the system.</p>
          </div>
        </header>
        <div className="dashboard-content">
          {error && <div className="error-message">{error}</div>}
          <div className="content-card">
            <div className="content-card-body">
              <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)} style={{ maxWidth: '220px', marginBottom: '16px' }}>
                <option value="">All actions</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>

              {isLoading ? <p>Loading...</p> : (
                <table className="document-table">
                  <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>When</th></tr></thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.username || 'system'}</td>
                        <td>{log.action}</td>
                        <td>{log.entity_type ? `${log.entity_type} #${log.entity_id}` : '—'}</td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.details ? JSON.stringify(log.details) : ''}
                        </td>
                        <td>{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && <tr><td colSpan="5">No logs found.</td></tr>}
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

export default AuditLogsPage;