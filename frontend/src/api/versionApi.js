import axiosClient from './axiosClient';

export async function fetchVersions(documentId) {
  const response = await axiosClient.get(`/api/documents/${documentId}/versions`);
  return response.data;
}

export async function downloadVersion(documentId, versionId) {
  const response = await axiosClient.get(`/api/documents/${documentId}/versions/${versionId}/download`, {
    responseType: 'blob'
  });
  return response;
}

export async function restoreVersion(documentId, versionId) {
  const response = await axiosClient.post(`/api/documents/${documentId}/versions/${versionId}/restore`);
  return response.data;
}

export async function compareVersions(documentId, v1, v2) {
  const response = await axiosClient.get(`/api/documents/${documentId}/versions/compare`, {
    params: { v1, v2 }
  });
  return response.data;
}
export async function publishVersion(documentId, versionId) {
  const response = await axiosClient.post(
    `/api/documents/${documentId}/versions/${versionId}/publish`
  );

  return response.data;
}