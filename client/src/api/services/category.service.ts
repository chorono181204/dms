import client from '../client';

export const getCategories = async (params?: any) => {
    const response = await client.get('/categories', { params });
    return response.data;
};

export const createCategory = async (data: any) => {
    const response = await client.post('/categories', data);
    return response.data;
};

export const updateCategory = async (id: number | string, data: any) => {
    const response = await client.patch(`/categories/${id}`, data);
    return response.data;
};

export const deleteCategory = async (id: number | string) => {
    const response = await client.delete(`/categories/${id}`);
    return response.data;
};

export const getCategory = async (id: number | string) => {
    const response = await client.get(`/categories/${id}`);
    return response.data;
};
