const COLORS = {
  draft: '#94a3b8',
  pending_review: '#f59e0b',
  approved: '#16a34a',
  rejected: '#dc2626',
  authentic: '#16a34a',
  tampered: '#dc2626',
  unknown: '#94a3b8',
  confirmed: '#16a34a',
  pending: '#f59e0b'
};

function StatusBadge({ status }) {
  const color = COLORS[status] || '#64748b';
  const label = (status || '').replace(/_/g, ' ');

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
        color: '#fff',
        background: color
      }}
    >
      {label}
    </span>
  );
}

export default StatusBadge;