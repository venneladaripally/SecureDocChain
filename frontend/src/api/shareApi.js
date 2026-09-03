import axiosClient from './axiosClient';

export async function shareDocument(documentId, username, canView, canDownload, expiresAt) {
  const response = await axiosClient.post(`/api/documents/${documentId}/share`, {
    username, canView, canDownload, expiresAt: expiresAt || null
  });
  return response.data;
}

export async function fetchDocumentShares(documentId) {
  const response = await axiosClient.get(`/api/documents/${documentId}/shares`);
  return response.data;
}

export async function revokeShare(shareId) {
  const response = await axiosClient.post(`/api/shares/${shareId}/revoke`);
  return response.data;
}

export async function fetchSharedWithMe() {
  const response = await axiosClient.get('/api/shares/shared-with-me');
  return response.data;
}