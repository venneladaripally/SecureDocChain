import axiosClient from './axiosClient';

export async function verifyDocumentFile(file, documentId, versionId) {
  const formData = new FormData();
  formData.append('file', file);
  if (documentId) formData.append('documentId', documentId);
  if (versionId) formData.append('versionId', versionId);

  const response = await axiosClient.post('/api/verify', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}