import axiosClient from './axiosClient';

export async function fetchDocuments(params = {}) {
  const response = await axiosClient.get('/api/documents', { params });
  return response.data;
}

export async function fetchDocument(id) {
  const response = await axiosClient.get(`/api/documents/${id}`);
  return response.data;
}

export async function uploadDocument(title, description, category, file) {
  const formData = new FormData();

  formData.append('title', title);
  formData.append('description', description);
  formData.append('category', category);
  formData.append('file', file);

  const response = await axiosClient.post('/api/documents', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

export async function editDocument(id, changeSummary, file) {
  const formData = new FormData();

  formData.append('changeSummary', changeSummary);
  formData.append('file', file);

  const response = await axiosClient.post(
    `/api/documents/${id}/edit`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );

  return response.data;
}

export async function deleteDocument(id) {
  const response = await axiosClient.delete(`/api/documents/${id}`);
  return response.data;
}

export async function downloadDocument(id) {
  const response = await axiosClient.get(
    `/api/documents/${id}/download`,
    {
      responseType: 'blob'
    }
  );

  return response;
}


// ============================================================
// DOCUMENT CHECK-OUT / LOCKING
// ============================================================

export async function checkoutDocument(id) {
  const response = await axiosClient.post(
    `/api/documents/${id}/checkout`
  );

  return response.data;
}

export async function cancelCheckout(id) {
  const response = await axiosClient.post(
    `/api/documents/${id}/cancel-checkout`
  );

  return response.data;
}