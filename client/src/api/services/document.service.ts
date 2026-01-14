import client from '../client';

const endpoint = '/documents';

export const getDocuments = async (params: any) => {
    const response = await client.get(endpoint, { params });
    return response.data;
};

export const createDocument = async (data: FormData) => {
    const response = await client.post(endpoint, data, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const updateDocument = async (id: number, data: FormData) => {
    const response = await client.patch(`${endpoint}/${id}`, data, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const deleteDocument = async (id: number) => {
    const response = await client.delete(`${endpoint}/${id}`);
    return response.data;
};

export const getDocument = async (id: number) => {
    const response = await client.get(`${endpoint}/${id}`);
    return response.data;
};

export const getPendingApprovals = async () => {
    const response = await client.get(`${endpoint}/pending-approvals`);
    return response.data;
};

export const approveDocument = async (id: number, comment?: string) => {
    const response = await client.post(`${endpoint}/${id}/approve`, { comment });
    return response.data;
};

export const rejectDocument = async (id: number, comment?: string) => {
    const response = await client.post(`${endpoint}/${id}/reject`, { comment });
    return response.data;
};

export const submitDocument = async (id: number) => {
    // We reuse the update endpoint to set status to PENDING
    // Since update expects FormData typically for file uploads, we can check if it supports JSON or just use FormData
    // The server controller uses req.body directly for fields, so JSON should work if the client supports it.
    // However, existing updateDocument uses FormData. Let's create a simple JSON patch if possible, 
    // OR just use FormData to be safe with existing conventions.
    const formData = new FormData();
    formData.append('status', 'PENDING');
    const response = await client.patch(`${endpoint}/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const getApprovalHistory = async () => {
    const response = await client.get(`${endpoint}/history-approvals`);
    return response.data;
};
