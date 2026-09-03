import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats()
      .then((data) => { setStats(data.stats); setActivity(data.recentActivity); })
      .catch(() => setError('Failed to load dashboard stats.'));
  }, []);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Admin Dashboard</h1>
            <p>System-wide statistics and recent activity.</p>
          </div>
        </header>
        <div className="dashboard-content">
          

          <div className="content-card">
            <div className="content-card-header"><div><h2>Recent activity</h2></div></div>
            <div className="content-card-body">
              <table className="document-table">
                <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>When</th></tr></thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td>{a.username || 'system'}</td>
                      <td>{a.action}</td>
                      <td>{a.entity_type ? `${a.entity_type} #${a.entity_id}` : '—'}</td>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboardPage;