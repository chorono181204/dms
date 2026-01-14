import client from '../api/client';

export interface Department {
    id: number;
    name: string;
    code: string;
}

const getDepartments = async (params: { limit?: number; page?: number } = { limit: 100, page: 1 }) => {
    const response = await client.get('/departments', { params });
    return response.data;
};

const createDepartment = async (data: Partial<Department>) => {
    const response = await client.post('/departments', data);
    return response.data;
};

const updateDepartment = async (id: number | string, data: Partial<Department>) => {
    const response = await client.patch(`/departments/${id}`, data);
    return response.data;
};

const deleteDepartment = async (id: number | string) => {
    const response = await client.delete(`/departments/${id}`);
    return response.data;
};

export default {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
};
