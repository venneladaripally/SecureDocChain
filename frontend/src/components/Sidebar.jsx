import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈', roles: null },
{ to: '/documents', label: 'Documents', icon: '▣', roles: ['admin', 'engineer', 'reviewer', 'viewer'] },  { to: '/reviews', label: 'Reviews', icon: '✓', roles: ['admin', 'reviewer'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: '◌', roles: ['admin', 'auditor'] },
  { to: '/admin/users', label: 'User Management', icon: '⚙', roles: ['admin'] },
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: '★', roles: ['admin'] },
  { to: '/profile', label: 'Profile', icon: '●', roles: null }
];

function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || user?.role_name;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        Secure<span>Doc</span>Chain
      </div>

      <div className="sidebar-section-title">Workspace</div>

      {LINKS.filter((link) => !link.roles || link.roles.includes(role)).map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          {link.icon} {link.label}
        </NavLink>
      ))}
    </aside>
  );
}

export default Sidebar;