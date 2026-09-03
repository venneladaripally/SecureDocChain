import axiosClient from './axiosClient';

export async function fetchDashboardStats() {
  const response = await axiosClient.get('/api/admin/dashboard');
  return response.data;
}

export async function fetchUsers(search) {
  const response = await axiosClient.get('/api/admin/users', { params: search ? { search } : {} });
  return response.data;
}

export async function fetchUserDetail(id) {
  const response = await axiosClient.get(`/api/admin/users/${id}`);
  return response.data;
}

export async function createUser(fullName, username, email, password, role) {
  const response = await axiosClient.post('/api/admin/users', { fullName, username, email, password, role });
  return response.data;
}

export async function changeUserRole(id, role) {
  const response = await axiosClient.patch(`/api/admin/users/${id}/role`, { role });
  return response.data;
}

export async function setUserStatus(id, isActive) {
  const response = await axiosClient.patch(`/api/admin/users/${id}/status`, { isActive });
  return response.data;
}