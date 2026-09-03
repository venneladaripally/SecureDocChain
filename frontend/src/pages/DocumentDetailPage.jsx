import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  fetchDocument,
  deleteDocument,
  editDocument,
  checkoutDocument,
  cancelCheckout
} from '../api/documentApi';

import {
  fetchVersions,
  downloadVersion,
  restoreVersion,
  compareVersions,
  publishVersion
} from '../api/versionApi';


import {
  shareDocument,
  fetchDocumentShares,
  revokeShare
} from '../api/shareApi';

import {
  reviewDocument,
  fetchDocumentReviews
} from '../api/reviewApi';

import { triggerBrowserDownload } from '../utils/downloadHelper';

import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';

function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  const role = user?.role || user?.role_name;

  // ============================================================
  // STATE
  // ============================================================

  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [shares, setShares] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Edit
  const [changeSummary, setChangeSummary] = useState('');
  const [editFile, setEditFile] = useState(null);

  // Share
  const [shareUsername, setShareUsername] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');

  // Review
  const [reviewComments, setReviewComments] = useState('');

  // Compare
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [reviewChanges, setReviewChanges] = useState(null);

  // ============================================================
  // CURRENT VERSION
  // ============================================================

  const currentVersion =
    versions.find((v) => v.is_current) || null;

  // ============================================================
  // OWNERSHIP / PERMISSIONS
  // ============================================================

  const currentUserId = user?.id
    ? Number(user.id)
    : null;

  const documentOwnerId = document?.uploaded_by
    ? Number(document.uploaded_by)
    : null;

  const isOwner =
    currentUserId !== null &&
    documentOwnerId !== null &&
    currentUserId === documentOwnerId;

  const isAdmin = role === 'admin';

  const isOwnerOrAdmin =
    isOwner || isAdmin;

  // ============================================================
  // CHECKOUT STATUS
  // ============================================================

  const checkedOutBy = document?.checked_out_by
    ? Number(document.checked_out_by)
    : null;

  const isCheckedOut =
    checkedOutBy !== null;

  const checkedOutByCurrentUser =
    currentUserId !== null &&
    checkedOutBy === currentUserId;

  const checkedOutByOtherUser =
    isCheckedOut &&
    !checkedOutByCurrentUser;

  // ============================================================
  // CAN CHECKOUT
  // ============================================================

  const canCheckout =
  (isOwnerOrAdmin || role === 'engineer') &&
  !isCheckedOut &&
  currentVersion &&
  [
    'published',
    'approved',
    'rejected'
  ].includes(
    currentVersion.version_status
  );

  // ============================================================
  // CAN REVIEW
  // ============================================================

  const canReview =
    (role === 'admin' || role === 'reviewer') &&
    currentVersion?.version_status === 'in_review';

  // ============================================================
  // LOAD EVERYTHING
  // ============================================================

  const loadAll = useCallback(async () => {
    try {
      setError('');

      const [
  docData,
  versionData,
  shareData,
  reviewData
] = await Promise.all([
  fetchDocument(id),

  fetchVersions(id),

  fetchDocumentShares(id)
    .catch(() => ({
      shares: []
    })),

  fetchDocumentReviews(id)
    .catch(() => ({
      reviews: []
    }))
]);

      setDocument(
        docData.document
      );

      setVersions(
        versionData.versions || []
      );

      

      setShares(
        shareData.shares || []
      );

      setReviews(
        reviewData.reviews || []
      );

    } catch (err) {
      console.error(
        '[ERROR] loadAll:',
        err
      );

      setError(
        err.response?.data?.message ||
        'Failed to load document.'
      );
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ============================================================
  // AUTOMATIC REVIEW CHANGE REPORT
  //
  // When a reviewer opens a version that is in_review, compare it
  // with the immediately preceding version automatically. This
  // means the reviewer does not have to know which two versions
  // to select before seeing what changed.
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function loadReviewChanges() {
      if (
        !canReview ||
        !currentVersion ||
        versions.length < 2
      ) {
        setReviewChanges(null);
        return;
      }

      const previousVersion = versions
        .filter(
          (v) =>
            Number(v.version_number) <
            Number(currentVersion.version_number)
        )
        .sort(
          (a, b) =>
            Number(b.version_number) -
            Number(a.version_number)
        )[0];

      if (!previousVersion) {
        setReviewChanges(null);
        return;
      }

      try {
        const data = await compareVersions(
          id,
          previousVersion.version_number,
          currentVersion.version_number
        );

        if (!cancelled) {
          setReviewChanges(data);
        }
      } catch (err) {
        console.error('[ERROR] loadReviewChanges:', err);
        if (!cancelled) {
          setReviewChanges({
            success: false,
            message: 'Unable to generate the automatic change report.'
          });
        }
      }
    }

    loadReviewChanges();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    canReview,
    currentVersion?.id,
    currentVersion?.version_number,
    versions.length
  ]);

  // ============================================================
  // DOWNLOAD CURRENT VERSION
  // ============================================================

  async function handleDownloadCurrent() {
    if (!currentVersion) {
      setError(
        'Current version not found.'
      );
      return;
    }

    try {
      setError('');
      setMessage('');

      const response =
        await downloadVersion(
          id,
          currentVersion.id
        );

      triggerBrowserDownload(
        response.data,
        currentVersion.file_name ||
          document.file_name
      );

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Download failed.'
      );
    }
  }

  // ============================================================
  // DOWNLOAD SPECIFIC VERSION
  // ============================================================

  async function handleDownloadVersion(
    versionId,
    fileName
  ) {
    try {
      setError('');
      setMessage('');

      const response =
        await downloadVersion(
          id,
          versionId
        );

      triggerBrowserDownload(
        response.data,
        fileName ||
          document.file_name
      );

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Download failed.'
      );
    }
  }

  // ============================================================
  // DELETE
  // ============================================================

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete this document? This cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setError('');
      setMessage('');

      await deleteDocument(id);

      navigate('/documents');

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Delete failed.'
      );
    }
  }

  // ============================================================
  // CHECKOUT
  // ============================================================

  async function handleCheckout() {
    try {
      setError('');
      setMessage('');

      await checkoutDocument(id);

      setMessage(
        'Document checked out successfully.'
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Failed to check out document.'
      );
    }
  }

  // ============================================================
  // CANCEL CHECKOUT
  // ============================================================

  async function handleCancelCheckout() {
    try {
      setError('');
      setMessage('');

      await cancelCheckout(id);

      setMessage(
        'Document checkout cancelled.'
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Failed to cancel checkout.'
      );
    }
  }

  // ============================================================
  // CREATE NEW VERSION
  // ============================================================

  async function handleEditSubmit(e) {
    e.preventDefault();

    setError('');
    setMessage('');

    if (!editFile) {
      setError(
        'Choose a file for the new version.'
      );
      return;
    }

    if (!checkedOutByCurrentUser) {
      setError(
        'You must check out the document before editing it.'
      );
      return;
    }

    try {
      await editDocument(
        id,
        changeSummary,
        editFile
      );

      setChangeSummary('');
      setEditFile(null);

      setMessage(
        'New version created successfully and submitted for review.'
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Failed to save new version.'
      );
    }
  }

  // ============================================================
  // RESTORE VERSION
  // ============================================================

  async function handleRestore(
    versionId,
    versionNumber
  ) {
    if (
      !window.confirm(
        `Restore version ${versionNumber}?`
      )
    ) {
      return;
    }

    try {
      setError('');
      setMessage('');

      await restoreVersion(
        id,
        versionId
      );

      setMessage(
        `Version ${versionNumber} restored successfully.`
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Restore failed.'
      );
    }
  }

  // ============================================================
  // PUBLISH
  // ============================================================

  async function handlePublish(
    versionId,
    versionNumber
  ) {
    if (
      !window.confirm(
        `Publish version ${versionNumber}? This will make it the official published version.`
      )
    ) {
      return;
    }

    try {
      setError('');
      setMessage('');

      await publishVersion(
        id,
        versionId
      );

      setMessage(
        `Version ${versionNumber} published successfully.`
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Failed to publish version.'
      );
    }
  }

  // ============================================================
  // SHARE
  // ============================================================

  async function handleShareSubmit(e) {
    e.preventDefault();

    setError('');
    setMessage('');

    try {
      await shareDocument(
        id,
        shareUsername,
        true,
        true,
        shareExpiry || null
      );

      setShareUsername('');
      setShareExpiry('');

      setMessage(
        'Document shared successfully.'
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Share failed.'
      );
    }
  }

  // ============================================================
  // REVOKE SHARE
  // ============================================================

  async function handleRevoke(
    shareId
  ) {
    try {
      setError('');
      setMessage('');

      await revokeShare(
        shareId
      );

      setMessage(
        'Share revoked successfully.'
      );

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Revoke failed.'
      );
    }
  }

  // ============================================================
  // REVIEW
  // ============================================================

  async function handleReview(
    versionId,
    versionNumber,
    status
  ) {
    if (!versionId) {
      setError(
        'Current version not found.'
      );
      return;
    }

    try {
      setError('');
      setMessage('');

      await reviewDocument(
        id,
        versionId,
        status,
        reviewComments
      );

      setMessage(
        `Version ${versionNumber} ${status} successfully.`
      );

      setReviewComments('');

      await loadAll();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        `Failed to ${status} version.`
      );
    }
  }

  // ============================================================
  // COMPARE
  // ============================================================

  async function handleCompare(e) {
    e.preventDefault();

    setError('');
    setMessage('');
    setCompareResult(null);

    if (!v1 || !v2) {
      setError(
        'Select two versions to compare.'
      );
      return;
    }

    if (v1 === v2) {
      setError(
        'Select two different versions.'
      );
      return;
    }

    try {
      const data =
        await compareVersions(
          id,
          v1,
          v2
        );

      setCompareResult(data);

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        'Comparison failed.'
      );
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (!document) {
    return (
      <div className="dashboard">

        <Sidebar />

        <main className="dashboard-main">

          <div className="dashboard-content">

            {error || 'Loading...'}

          </div>

        </main>

      </div>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-main">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="dashboard-header">

          <div className="dashboard-title">

            <h1>
              {document.title}
            </h1>

            <p>
              {document.description ||
                'No description'}
            </p>

          </div>

        </header>

        <div className="dashboard-content">

          {/* ====================================================
              MESSAGES
          ==================================================== */}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {/* ====================================================
              DOCUMENT INFORMATION
          ==================================================== */}

          <div className="content-card">

            <div
              className="content-card-body"
              style={{
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >

              <StatusBadge
                status={document.status}
              />

              <span>
                Category:{' '}
                {document.category || '—'}
              </span>

              <span>
                Uploaded by:{' '}
                {document.uploaded_by_username ||
                  '—'}
              </span>

              <span>
                Last updated:{' '}
                {document.updated_at
                  ? new Date(
                      document.updated_at
                    ).toLocaleString()
                  : '—'}
              </span>

              <button
                className="download-button"
                onClick={
                  handleDownloadCurrent
                }
              >
                Download current version
              </button>

              {isOwnerOrAdmin &&  (
                <button
                  className="download-button"
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626'
                  }}
                  onClick={handleDelete}
                >
                  Delete document
                </button>
              )}

            </div>

          </div>

          {/* ====================================================
              DOCUMENT LOCK / EDIT
          ==================================================== */}

          {(isOwnerOrAdmin || role === 'engineer') && (

            <div className="content-card">

              <div className="content-card-header">

                <div>

                  <h2>
                    Document Lock
                  </h2>

                  <p>
                    A document must be checked out
                    before creating a new version.
                  </p>

                </div>

              </div>

              <div className="content-card-body">

                {/* ------------------------------------------------
                    AVAILABLE
                ------------------------------------------------ */}

                {!isCheckedOut && (

                  <div>

                    <div
                      style={{
                        marginBottom: '15px'
                      }}
                    >
                      🔓{' '}
                      <strong>
                        Available for editing
                      </strong>
                    </div>

                    {canCheckout ? (

                      <button
                        className="upload-button"
                        type="button"
                        onClick={
                          handleCheckout
                        }
                        style={{
                          width: 'auto',
                          padding: '10px 20px'
                        }}
                      >
                        Check Out
                      </button>

                    ) : (

                      <p
                        style={{
                          color: '#667085'
                        }}
                      >
                        This document cannot
                        currently be checked out.
                        The current version must
                        be approved, rejected,
                        or published first.
                      </p>

                    )}

                  </div>

                )}

                {/* ------------------------------------------------
                    CHECKED OUT BY CURRENT USER
                ------------------------------------------------ */}

                {checkedOutByCurrentUser && (

                  <div>

                    <div
                      style={{
                        marginBottom: '15px'
                      }}
                    >
                      🔒{' '}
                      <strong>
                        Checked out by you
                      </strong>
                    </div>

                    <p
                      style={{
                        color: '#667085',
                        marginBottom: '15px'
                      }}
                    >
                      You can now upload a new
                      version.
                    </p>

                    <form
                      className="upload-form"
                      onSubmit={
                        handleEditSubmit
                      }
                    >

                      <div className="form-group full-width">

                        <label>
                          What changed?
                        </label>

                        <input
                          className="form-input"
                          value={
                            changeSummary
                          }
                          onChange={(e) =>
                            setChangeSummary(
                              e.target.value
                            )
                          }
                          placeholder="Describe what changed"
                          required
                        />

                      </div>

                      <div className="form-group full-width">

                        <label>
                          New file
                        </label>

                        <input
                          className="file-input"
                          type="file"
                          onChange={(e) =>
                            setEditFile(
                              e.target.files[0] ||
                              null
                            )
                          }
                          required
                        />

                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}
                      >

                        <button
                          className="upload-button"
                          type="submit"
                          style={{
                            width: 'auto',
                            padding: '10px 20px'
                          }}
                        >
                          Save New Version
                        </button>

                        <button
                          className="download-button"
                          type="button"
                          onClick={
                            handleCancelCheckout
                          }
                        >
                          Cancel Checkout
                        </button>

                      </div>

                    </form>

                  </div>

                )}

                {/* ------------------------------------------------
                    CHECKED OUT BY SOMEONE ELSE
                ------------------------------------------------ */}

                {checkedOutByOtherUser && (

                  <div>

                    <div
                      style={{
                        marginBottom: '10px'
                      }}
                    >
                      🔒{' '}
                      <strong>
                        Document is locked
                      </strong>
                    </div>

                    <p
                      style={{
                        color: '#667085'
                      }}
                    >
                      Checked out by another
                      user.
                    </p>

                    {document.checked_out_at && (

                      <p
                        style={{
                          color: '#667085'
                        }}
                      >
                        Since:{' '}
                        {new Date(
                          document.checked_out_at
                        ).toLocaleString()}
                      </p>

                    )}

                    {role === 'admin' && (

                      <button
                        className="download-button"
                        type="button"
                        onClick={
                          handleCancelCheckout
                        }
                      >
                        Force Cancel Checkout
                      </button>

                    )}

                  </div>

                )}

              </div>

            </div>

          )}

          {/* ====================================================
              VERSION HISTORY
          ==================================================== */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Version history
                </h2>

                <p>
                  Every version is stored independently
                  with its own SHA-256 hash.
                </p>

              </div>

            </div>

            <div
              className="content-card-body"
              style={{
                overflowX: 'auto'
              }}
            >

              <table className="document-table">

                <thead>

                  <tr>

                    <th>
                      Version
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Current
                    </th>

                    <th>
                      SHA-256
                    </th>

                    <th>
                      Uploaded by
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {versions.map((v) => (

                    <tr key={v.id}>

                      <td>
                        v{v.version_number}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            v.version_status
                          }
                        />
                      </td>

                      <td>
                        {v.is_current
                          ? '✅ Current'
                          : '—'}
                      </td>

                      <td
                        style={{
                          fontFamily:
                            'monospace',
                          fontSize: '12px'
                        }}
                      >
                        {v.sha256_hash
                          ? `${v.sha256_hash.slice(
                              0,
                              16
                            )}...`
                          : '—'}
                      </td>

                      <td>
                        {v.uploaded_by_username ||
                          '—'}
                      </td>

                      <td>
                        {v.created_at
                          ? new Date(
                              v.created_at
                            ).toLocaleString()
                          : '—'}
                      </td>

                      <td>

                        <div
                          className="document-actions"
                          style={{
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap'
                          }}
                        >

                          <button
                            className="download-button"
                            onClick={() =>
                              handleDownloadVersion(
                                v.id,
                                v.file_name
                              )
                            }
                          >
                            Download
                          </button>

                          {isOwnerOrAdmin &&
                            !v.is_current && (

                              <button
                                className="download-button"
                                onClick={() =>
                                  handleRestore(
                                    v.id,
                                    v.version_number
                                  )
                                }
                              >
                                Restore
                              </button>

                            )}

                          {role === 'admin' &&
                            v.version_status ===
                              'approved' && (

                              <button
                                className="publish-button"
                                onClick={() =>
                                  handlePublish(
                                    v.id,
                                    v.version_number
                                  )
                                }
                              >
                                Publish
                              </button>

                            )}

                        </div>

                      </td>

                    </tr>

                  ))}

                  {versions.length === 0 && (

                    <tr>

                      <td
                        colSpan="7"
                        style={{
                          textAlign: 'center'
                        }}
                      >
                        No versions found.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* ====================================================
              COMPARE VERSIONS
          ==================================================== */}

          {/* ====================================================
    COMPARE VERSIONS
==================================================== */}

{versions.length >= 2 && (

  <div className="content-card">

    <div className="content-card-header">

      <div>

        <h2>
          Compare versions
        </h2>

        <p>
          Text documents are compared line-by-line.
          Word and PDF files use extracted text.
          Images are compared pixel-by-pixel.
          SHA-256 hashes are used for integrity verification.
        </p>

      </div>

    </div>

    <div className="content-card-body">

      {/* ==================================================
          VERSION SELECTION
      ================================================== */}

      <form
        onSubmit={handleCompare}
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >

        <select
          className="form-input"
          value={v1}
          onChange={(e) =>
            setV1(e.target.value)
          }
          required
        >

          <option value="">
            Version A
          </option>

          {versions.map((v) => (

            <option
              key={v.id}
              value={v.version_number}
            >
              v{v.version_number}
              {' — '}
              {v.file_name}
            </option>

          ))}

        </select>


        <select
          className="form-input"
          value={v2}
          onChange={(e) =>
            setV2(e.target.value)
          }
          required
        >

          <option value="">
            Version B
          </option>

          {versions.map((v) => (

            <option
              key={v.id}
              value={v.version_number}
            >
              v{v.version_number}
              {' — '}
              {v.file_name}
            </option>

          ))}

        </select>


        <button
          className="upload-button"
          type="submit"
          style={{
            width: 'auto',
            padding: '10px 24px'
          }}
        >
          Compare
        </button>

      </form>


      {/* ==================================================
          COMPARISON RESULT
      ================================================== */}

      {compareResult && (

        <div>

          {/* ================================================
              RESULT SUMMARY
          ================================================ */}

          <div
            style={{
              padding: '14px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              background:
                compareResult.hashesDiffer
                  ? '#fffbeb'
                  : '#ecfdf3',
              border:
                compareResult.hashesDiffer
                  ? '1px solid #fde68a'
                  : '1px solid #bbf7d0'
            }}
          >

            <strong>
              {compareResult.message}
            </strong>

          </div>


          {/* ================================================
              VERSION INFORMATION
          ================================================ */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
              marginBottom: '16px'
            }}
          >

            {/* ----------------------------------------------
                VERSION A
            ---------------------------------------------- */}

            <div
              style={{
                padding: '12px',
                border: '1px solid #eaecf0',
                borderRadius: '8px',
                background: '#f8fafc'
              }}
            >

              <strong>
                Version{' '}
                {compareResult.versionA?.version_number}
              </strong>

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '13px'
                }}
              >
                {compareResult.versionA?.file_name}
              </div>

              <div
                style={{
                  marginTop: '8px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  wordBreak: 'break-all',
                  color: '#667085'
                }}
              >
                SHA-256:
                <br />
                {compareResult.versionA?.sha256_hash || '—'}
              </div>

            </div>


            {/* ----------------------------------------------
                VERSION B
            ---------------------------------------------- */}

            <div
              style={{
                padding: '12px',
                border: '1px solid #eaecf0',
                borderRadius: '8px',
                background: '#f8fafc'
              }}
            >

              <strong>
                Version{' '}
                {compareResult.versionB?.version_number}
              </strong>

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '13px'
                }}
              >
                {compareResult.versionB?.file_name}
              </div>

              <div
                style={{
                  marginTop: '8px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  wordBreak: 'break-all',
                  color: '#667085'
                }}
              >
                SHA-256:
                <br />
                {compareResult.versionB?.sha256_hash || '—'}
              </div>

            </div>

          </div>


          {/* ==================================================
              SUPPORTED COMPARISON
          ================================================== */}

          {compareResult.supported ? (

            <div>

              {/* ==============================================
                  IMAGE RESULT
              ============================================== */}

              {compareResult.comparisonType === 'image' ? (

                <div
                  style={{
                    border: '1px solid #eaecf0',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}
                >

                  <div
                    style={{
                      padding: '14px',
                      background: '#f8fafc',
                      borderBottom:
                        '1px solid #eaecf0',
                      fontWeight: 600
                    }}
                  >
                    Image Comparison
                  </div>


                  <div
                    style={{
                      padding: '16px'
                    }}
                  >

                    {compareResult.imageComparison ? (

                      <>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '12px'
                          }}
                        >

                          <div>
                            <strong>
                              Dimensions
                            </strong>

                            <div>
                              {compareResult.imageComparison.widthA}
                              {' × '}
                              {compareResult.imageComparison.heightA}
                            </div>
                          </div>


                          <div>
                            <strong>
                              Different Pixels
                            </strong>

                            <div>
                              {compareResult.imageComparison.diffPixels === null
                                ? '—'
                                : compareResult.imageComparison.diffPixels.toLocaleString()}
                            </div>
                          </div>


                          <div>
                            <strong>
                              Total Pixels
                            </strong>

                            <div>
                              {compareResult.imageComparison.totalPixels === null
                                ? '—'
                                : compareResult.imageComparison.totalPixels.toLocaleString()}
                            </div>
                          </div>


                          <div>
                            <strong>
                              Difference
                            </strong>

                            <div>
                              {compareResult.imageComparison.differencePercent === null
                                ? '—'
                                : `${compareResult.imageComparison.differencePercent}%`}
                            </div>
                          </div>

                        </div>


                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px',
                            borderRadius: '6px',
                            background:
                              compareResult.imageComparison.identical
                                ? '#ecfdf3'
                                : '#fffbeb'
                          }}
                        >

                          {compareResult.imageComparison.message}

                        </div>

                      </>

                    ) : (

                      <p>
                        Image comparison information
                        is unavailable.
                      </p>

                    )}

                  </div>

                </div>

              ) : (

                /* ==========================================
                   TEXT / WORD / PDF RESULT
                ========================================== */

                <div>

                  {/* ------------------------------------------
                      CHANGE STATISTICS
                  ------------------------------------------ */}

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginBottom: '16px'
                    }}
                  >

                    <span
                      style={{
                        padding: '7px 11px',
                        borderRadius: '999px',
                        background: '#ecfdf3',
                        color: '#067647',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      +{compareResult.changeStats?.added || 0}
                      {' '}Added
                    </span>


                    <span
                      style={{
                        padding: '7px 11px',
                        borderRadius: '999px',
                        background: '#fef2f2',
                        color: '#b42318',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      -{compareResult.changeStats?.removed || 0}
                      {' '}Removed
                    </span>


                    <span
                      style={{
                        padding: '7px 11px',
                        borderRadius: '999px',
                        background: '#fffaeb',
                        color: '#b54708',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      {compareResult.changeStats?.modified || 0}
                      {' '}Modified
                    </span>


                    <span
                      style={{
                        padding: '7px 11px',
                        borderRadius: '999px',
                        background: '#f2f4f7',
                        color: '#344054',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      {compareResult.comparisonType?.toUpperCase()}
                    </span>

                  </div>


                  {/* ------------------------------------------
                      APPROXIMATE WARNING
                  ------------------------------------------ */}

                  {compareResult.approximate && (

                    <div
                      style={{
                        marginBottom: '14px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: '#fffaeb',
                        color: '#92400e',
                        fontSize: '13px'
                      }}
                    >
                      This is an approximate comparison because
                      the document is large.
                    </div>

                  )}


                  {/* ------------------------------------------
                      NO CHANGES
                  ------------------------------------------ */}

                  {(!compareResult.diffLines ||
                    compareResult.diffLines.length === 0) ? (

                    <div
                      style={{
                        padding: '18px',
                        textAlign: 'center',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        background: '#ecfdf3',
                        color: '#166534'
                      }}
                    >
                      <strong>
                        No content changes detected.
                      </strong>

                      {compareResult.hashesDiffer && (

                        <p
                          style={{
                            marginTop: '8px',
                            marginBottom: 0,
                            fontSize: '13px'
                          }}
                        >
                          However, the SHA-256 hashes differ.
                          This may indicate formatting, metadata,
                          embedded objects, or other non-text
                          changes.
                        </p>

                      )}

                    </div>

                  ) : (

                    /* ------------------------------------------
                       CHANGE LIST
                    ------------------------------------------ */

                    <div
                      style={{
                        border: '1px solid #eaecf0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        maxHeight: '560px',
                        overflowY: 'auto'
                      }}
                    >

                      {compareResult.diffLines
                        .filter(
                          (line) =>
                            line.type !== 'unchanged'
                        )
                        .map((line, index) => {

                          const isAdded =
                            line.type === 'added';

                          const isRemoved =
                            line.type === 'removed';

                          const isModified =
                            line.type === 'modified';


                          let background =
                            '#fffbeb';

                          let border =
                            '#fde68a';

                          let label =
                            'MODIFIED';

                          let labelColor =
                            '#b54708';


                          if (isAdded) {

                            background =
                              '#f0fdf4';

                            border =
                              '#bbf7d0';

                            label =
                              'ADDED';

                            labelColor =
                              '#15803d';

                          } else if (isRemoved) {

                            background =
                              '#fef2f2';

                            border =
                              '#fecaca';

                            label =
                              'REMOVED';

                            labelColor =
                              '#b42318';
                          }


                          return (

                            <div
                              key={`${line.type}-${line.line}-${index}`}
                              style={{
                                padding: '12px 14px',
                                background,
                                borderBottom:
                                  `1px solid ${border}`
                              }}
                            >

                              {/* --------------------------------
                                  HEADER
                              -------------------------------- */}

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '9px',
                                  marginBottom: '8px',
                                  flexWrap: 'wrap'
                                }}
                              >

                                <strong
                                  style={{
                                    color: labelColor,
                                    fontSize: '12px'
                                  }}
                                >
                                  {label}
                                </strong>


                                <span
                                  style={{
                                    color: '#667085',
                                    fontSize: '12px'
                                  }}
                                >
                                  {line.aLine
                                    ? `V${compareResult.versionA?.version_number} Line ${line.aLine}`
                                    : 'V1 —'}
                                </span>


                                <span
                                  style={{
                                    color: '#98a2b3'
                                  }}
                                >
                                  →
                                </span>


                                <span
                                  style={{
                                    color: '#667085',
                                    fontSize: '12px'
                                  }}
                                >
                                  {line.bLine
                                    ? `V${compareResult.versionB?.version_number} Line ${line.bLine}`
                                    : 'V2 —'}
                                </span>

                              </div>


                              {/* --------------------------------
                                  OLD CONTENT
                              -------------------------------- */}

                              {(isRemoved ||
                                isModified) &&
                                line.versionA !== '' && (

                                  <div
                                    style={{
                                      padding: '9px 11px',
                                      marginBottom:
                                        isModified
                                          ? '6px'
                                          : 0,
                                      background: '#fee2e2',
                                      borderLeft:
                                        '4px solid #ef4444',
                                      color: '#991b1b',
                                      fontFamily: 'monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}
                                  >

                                    <strong
                                      style={{
                                        marginRight: '8px'
                                      }}
                                    >
                                      −
                                    </strong>

                                    {line.versionA}

                                  </div>

                                )}


                              {/* --------------------------------
                                  NEW CONTENT
                              -------------------------------- */}

                              {(isAdded ||
                                isModified) &&
                                line.versionB !== '' && (

                                  <div
                                    style={{
                                      padding: '9px 11px',
                                      background: '#dcfce7',
                                      borderLeft:
                                        '4px solid #22c55e',
                                      color: '#166534',
                                      fontFamily: 'monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}
                                  >

                                    <strong
                                      style={{
                                        marginRight: '8px'
                                      }}
                                    >
                                      +
                                    </strong>

                                    {line.versionB}

                                  </div>

                                )}

                            </div>

                          );
                        })}

                    </div>

                  )}

                </div>

              )}

            </div>

          ) : (

            /* ==================================================
               UNSUPPORTED / HASH-ONLY COMPARISON
            ================================================== */

            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #eaecf0'
              }}
            >

              <p
                style={{
                  marginTop: 0
                }}
              >
                {compareResult.message}
              </p>


              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >

                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background:
                      compareResult.hashesDiffer
                        ? '#fef2f2'
                        : '#ecfdf3',
                    color:
                      compareResult.hashesDiffer
                        ? '#b42318'
                        : '#067647',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}
                >
                  SHA-256:{' '}
                  {compareResult.hashesDiffer
                    ? 'Different'
                    : 'Match'}
                </span>

              </div>

            </div>

          )}

        </div>

      )}

    </div>

  </div>

)}
          {/* ====================================================
              BLOCKCHAIN
          ==================================================== */}

         

          {/* ====================================================
              SHARING
          ==================================================== */}

          {isOwnerOrAdmin && (

            <div className="content-card">

              <div className="content-card-header">

                <div>

                  <h2>
                    Share this document
                  </h2>

                  <p>
                    Always shares the current version.
                  </p>

                </div>

              </div>

              <div className="content-card-body">

                <form
                  onSubmit={handleShareSubmit}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '16px',
                    flexWrap: 'wrap'
                  }}
                >

                  <input
                    className="form-input"
                    placeholder="Username to share with"
                    value={shareUsername}
                    onChange={(e) =>
                      setShareUsername(
                        e.target.value
                      )
                    }
                    required
                  />

                  <input
                    className="form-input"
                    type="datetime-local"
                    value={shareExpiry}
                    onChange={(e) =>
                      setShareExpiry(
                        e.target.value
                      )
                    }
                  />

                  <button
                    className="upload-button"
                    type="submit"
                    style={{
                      width: 'auto',
                      padding: '10px 20px'
                    }}
                  >
                    Share
                  </button>

                </form>

                <div
                  style={{
                    overflowX: 'auto'
                  }}
                >

                  <table className="document-table">

                    <thead>

                      <tr>

                        <th>
                          Shared with
                        </th>

                        <th>
                          Expires
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Date
                        </th>

                        <th>
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {shares.map((s) => (

                        <tr key={s.id}>

                          <td>
                            {s.shared_with_username ||
                              '—'}
                          </td>

                          <td>
                            {s.expires_at
                              ? new Date(
                                  s.expires_at
                                ).toLocaleString()
                              : 'Never'}
                          </td>

                          <td>
                            {s.revoked
                              ? 'Revoked'
                              : 'Active'}
                          </td>

                          <td>
                            {s.created_at
                              ? new Date(
                                  s.created_at
                                ).toLocaleString()
                              : '—'}
                          </td>

                          <td>

                            {!s.revoked && (

                              <button
                                className="download-button"
                                onClick={() =>
                                  handleRevoke(
                                    s.id
                                  )
                                }
                              >
                                Revoke
                              </button>

                            )}

                          </td>

                        </tr>

                      ))}

                      {shares.length === 0 && (

                        <tr>

                          <td
                            colSpan="5"
                            style={{
                              textAlign:
                                'center'
                            }}
                          >
                            No active or previous
                            shares.
                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

          )}

          {/* ====================================================
              CHANGES APPLIED
          ==================================================== */}

          {canReview && reviewChanges && (
            <div className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>
                    Changes applied in Version {currentVersion.version_number}
                  </h2>
                  <p>
                    Automatically generated from the previous version file.
                    This is the change report the reviewer should use before
                    approving or rejecting the version.
                  </p>
                </div>
              </div>

              <div className="content-card-body">
                {reviewChanges.success === false ? (
                  <div className="error-message">
                    {reviewChanges.message}
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        marginBottom: '16px'
                      }}
                    >
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: '#ecfdf3',
                          color: '#067647',
                          fontWeight: 600
                        }}
                      >
                        +{reviewChanges.changeStats?.added || 0} added
                      </span>

                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: '#fef2f2',
                          color: '#b42318',
                          fontWeight: 600
                        }}
                      >
                        -{reviewChanges.changeStats?.removed || 0} removed
                      </span>

                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: '#fffaeb',
                          color: '#b54708',
                          fontWeight: 600
                        }}
                      >
                        {reviewChanges.changeStats?.modified || 0} modified
                      </span>

                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: '#f2f4f7',
                          color: '#344054',
                          fontWeight: 600
                        }}
                      >
                        Comparing v{reviewChanges.versionA?.version_number}
                        {' → '}
                        v{reviewChanges.versionB?.version_number}
                      </span>
                    </div>

                    {reviewChanges.supported ? (
                      reviewChanges.diffLines?.length > 0 ? (
                        <div
                          style={{
                            border: '1px solid #eaecf0',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}
                        >
                          {reviewChanges.diffLines.map((line, index) => {
                            const isAdded = line.type === 'added';
                            const isRemoved = line.type === 'removed';
                            const background = isAdded
                              ? '#ecfdf3'
                              : isRemoved
                                ? '#fef2f2'
                                : '#fffaeb';

                            return (
                              <div
                                key={`${line.type}-${line.line}-${index}`}
                                style={{
                                  background,
                                  padding: '9px 12px',
                                  borderBottom: '1px solid #eaecf0',
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  whiteSpace: 'pre-wrap'
                                }}
                              >
                                <strong>
                                  {isAdded
                                    ? '+'
                                    : isRemoved
                                      ? '-'
                                      : '~'}
                                  {' Line '}
                                  {line.line}
                                </strong>
                                {'  '}
                                {isRemoved ? (
                                  <span>- {line.versionA}</span>
                                ) : isAdded ? (
                                  <span>+ {line.versionB}</span>
                                ) : (
                                  <span>
                                    - {line.versionA}
                                    {'  /  '}
                                    + {line.versionB}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p>
                          No content changes were detected between these
                          versions.
                        </p>
                      )
                    ) : (
                      <div>
                        <p>
                          {reviewChanges.message}
                        </p>
                        <p
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        >
                          Previous hash: {reviewChanges.versionA?.sha256_hash}
                          <br />
                          New hash: {reviewChanges.versionB?.sha256_hash}
                        </p>
                      </div>
                    )}

                    {reviewChanges.approximate && (
                      <p
                        style={{
                          marginTop: '12px',
                          color: '#667085',
                          fontSize: '13px'
                        }}
                      >
                        Note: this is an approximate line-position comparison
                        because the file is large.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ====================================================
              REVIEW
          ==================================================== */}

          {canReview && (

            <div className="content-card">

              <div className="content-card-header">

                <div>

                  <h2>
                    Review Version{' '}
                    {currentVersion.version_number}
                  </h2>

                  <p>
                    Review the current working
                    version before it can be
                    approved or rejected.
                  </p>

                </div>

              </div>

              <div className="content-card-body">

                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Review comments"
                  value={reviewComments}
                  onChange={(e) =>
                    setReviewComments(
                      e.target.value
                    )
                  }
                  style={{
                    marginBottom: '10px',
                    width: '100%'
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    gap: '10px'
                  }}
                >

                  <button
                    className="upload-button"
                    type="button"
                    style={{
                      width: 'auto',
                      padding: '10px 20px'
                    }}
                    onClick={() =>
                      handleReview(
                        currentVersion.id,
                        currentVersion.version_number,
                        'approved'
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    className="download-button"
                    type="button"
                    style={{
                      background: '#fee2e2',
                      color: '#dc2626'
                    }}
                    onClick={() =>
                      handleReview(
                        currentVersion.id,
                        currentVersion.version_number,
                        'rejected'
                      )
                    }
                  >
                    Reject
                  </button>

                </div>

              </div>

            </div>

          )}

          {/* ====================================================
              REVIEW HISTORY
          ==================================================== */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Review history
                </h2>

                <p>
                  Complete review decisions for
                  every document version.
                </p>

              </div>

            </div>

            <div
              className="content-card-body"
              style={{
                overflowX: 'auto'
              }}
            >

              <table className="document-table">

                <thead>

                  <tr>

                    <th>
                      Version
                    </th>

                    <th>
                      Reviewer
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Comments
                    </th>

                    <th>
                      Date
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {reviews.map((r) => (

                    <tr key={r.id}>

                      <td>
                        v{r.version_number}
                      </td>

                      <td>
                        {r.reviewer_username ||
                          '—'}
                      </td>

                      <td>
                        <StatusBadge
                          status={r.status}
                        />
                      </td>

                      <td>
                        {r.comments || '—'}
                      </td>

                      <td>
                        {new Date(
                          r.reviewed_at ||
                            r.created_at
                        ).toLocaleString()}
                      </td>

                    </tr>

                  ))}

                  {reviews.length === 0 && (

                    <tr>

                      <td
                        colSpan="5"
                        style={{
                          textAlign:
                            'center'
                        }}
                      >
                        No reviews yet.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default DocumentDetailPage;