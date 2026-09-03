import axiosClient from './axiosClient';

export async function fetchPendingReviews() {
  const response = await axiosClient.get('/api/reviews/pending');
  return response.data;
}

export async function reviewDocument(
  documentId,
  versionId,
  status,
  comments
) {
  const response = await axiosClient.post(
    `/api/documents/${documentId}/versions/${versionId}/review`,
    {
      status,
      comments
    }
  );

  return response.data;
}

export async function fetchDocumentReviews(documentId) {
  const response = await axiosClient.get(`/api/documents/${documentId}/reviews`);
  return response.data;
}