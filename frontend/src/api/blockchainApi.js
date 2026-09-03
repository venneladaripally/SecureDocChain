import axiosClient from './axiosClient';

export async function fetchDocumentBlockchain(documentId) {
  const response = await axiosClient.get(`/api/blockchain/document/${documentId}`);
  return response.data;
}

export async function fetchBlockchainStats() {
  const response = await axiosClient.get('/api/blockchain/stats');
  return response.data;
}

export async function verifyChain() {
  const response = await axiosClient.get('/api/blockchain/verify-chain');
  return response.data;
}