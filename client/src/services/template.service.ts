import client from '../api/client';

export interface Template {
    id: number;
    name: string;
    content: string;
    categoryId?: number;
    category?: {
        id: number;
        name: string;
    };
    departmentId?: number;
    department?: {
        id: number;
        name: string;
    };
    isActive: boolean;
    visibility: string;
    accessLevel: string;
    permissions?: any[];
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

const createTemplate = async (data: any) => {
    const response = await client.post('/templates', data);
    return response.data;
};

const getTemplates = async (params: any) => {
    const response = await client.get('/templates', { params });
    return response.data;
};

const getTemplate = async (id: number) => {
    const response = await client.get(`/templates/${id}`);
    return response.data;
};

const updateTemplate = async (id: number, data: any) => {
    const response = await client.patch(`/templates/${id}`, data);
    return response.data;
};

const deleteTemplate = async (id: number) => {
    const response = await client.delete(`/templates/${id}`);
    return response.data;
};

export default {
    createTemplate,
    getTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate
};
