import axiosClient from './axiosClient';

export async function fetchAuditLogs(params = {}) {
  const response = await axiosClient.get('/api/audit-logs', { params });
  return response.data;
}

export async function fetchDocumentAuditTrail(documentId) {
  const response = await axiosClient.get(`/api/audit-logs/document/${documentId}`);
  return response.data;
}