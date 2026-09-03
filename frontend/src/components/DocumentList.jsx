import { Link } from 'react-router-dom';
import {
  downloadDocument,
  checkoutDocument,
  cancelCheckout
} from '../api/documentApi';
import { triggerBrowserDownload } from '../utils/downloadHelper';
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentList({ documents, onDownloadError }) {
  const { user } = useAuth();

  async function handleDownload(doc) {
    try {
      const response = await downloadDocument(doc.id);

      triggerBrowserDownload(
        response.data,
        doc.file_name
      );
    } catch (err) {
      onDownloadError(
        `Failed to download "${doc.title}"`
      );
    }
  }

  // ==========================================================
  // CHECK OUT
  // ==========================================================

  async function handleCheckout(doc) {
    try {
      await checkoutDocument(doc.id);

      window.location.reload();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Failed to check out document';

      alert(message);
    }
  }

  // ==========================================================
  // CANCEL CHECKOUT
  // ==========================================================

  async function handleCancelCheckout(doc) {
    try {
      await cancelCheckout(doc.id);

      window.location.reload();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Failed to cancel checkout';

      alert(message);
    }
  }

  if (documents.length === 0) {
    return (
      <div
        style={{
          padding: '35px',
          textAlign: 'center',
          color: '#667085'
        }}
      >
        No documents found.
      </div>
    );
  }

  return (
    <div className="document-table-wrapper">
    <table className="document-table">
      <thead>
        <tr>
          <th>Document</th>
          <th>Status</th>
          <th>Version</th>
          <th>Uploaded by</th>
          <th>Size</th>
          <th>Date</th>
          <th>Lock</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {documents.map((doc) => {
          const currentUserId = user?.id
            ? Number(user.id)
            : null;

          const checkedOutBy = doc.checked_out_by
            ? Number(doc.checked_out_by)
            : null;

          const isCheckedOut =
            checkedOutBy !== null;

          const checkedOutByCurrentUser =
            currentUserId !== null &&
            checkedOutBy === currentUserId;

          return (
            <tr key={doc.id}>

              {/* DOCUMENT */}
              <td>
                <div className="document-name">
                  <Link to={`/documents/${doc.id}`}>
                    {doc.title}
                  </Link>
                </div>

                {doc.description && (
                  <div className="document-description">
                    {doc.description}
                  </div>
                )}
              </td>

              {/* STATUS */}
              <td>
                <StatusBadge status={doc.status} />
              </td>

              {/* VERSION */}
              <td>
                v{doc.version_count || 1}
              </td>

              {/* UPLOADED BY */}
              <td>
                {doc.uploaded_by_username}
              </td>

              {/* SIZE */}
              <td>
                {formatFileSize(doc.file_size)}
              </td>

              {/* DATE */}
              <td>
                {new Date(
                  doc.created_at
                ).toLocaleDateString()}
              </td>

              {/* LOCK */}
              <td>
                {!isCheckedOut && (
                  <span>
                    🔓 Available
                  </span>
                )}

                {isCheckedOut &&
                  checkedOutByCurrentUser && (
                    <span>
                      🔒 Checked out by you
                    </span>
                  )}

                {isCheckedOut &&
                  !checkedOutByCurrentUser && (
                    <span>
                      🔒 Locked
                    </span>
                  )}
              </td>

              {/* ACTIONS */}
              {/* ACTIONS */}
<td>
  <div className="document-actions">
    <button
      className="download-button"
      onClick={() => handleDownload(doc)}
    >
      Download
    </button>

    {/* AVAILABLE */}
    {(user?.role === 'admin' || user?.role === 'engineer') &&
  !isCheckedOut &&
  ['published', 'approved', 'rejected'].includes(doc.status) && (
    <button
      className="checkout-button"
      onClick={() => handleCheckout(doc)}
    >
      Check Out
    </button>
)}

    {/* LOCKED BY CURRENT USER */}
    {user?.role !== 'viewer' && checkedOutByCurrentUser && (
  <button
    className="cancel-checkout-button"
    onClick={() => handleCancelCheckout(doc)}
  >
    Cancel Checkout
  </button>
)}
  </div>
</td>

            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export default DocumentList;