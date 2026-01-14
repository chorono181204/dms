import client from '../client';

export const getDepartments = async (params?: any) => {
    const response = await client.get('/departments', { params });
    return response.data;
};
