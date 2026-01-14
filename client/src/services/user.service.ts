import client from '../api/client';

export interface User {
    id: number;
    username: string;
    name: string;
    role: string;
    departmentId?: number;
    department?: {
        id: number;
        name: string;
    };
    isActive?: boolean; // API might not have this, check schema. Default prisma user doesn't have isActive, check schema.
    isEmailVerified: boolean;
    lastLogin?: string; // API might not return this yet.
}

export interface GetUsersParams {
    name?: string;
    role?: string;
    sortBy?: string;
    limit?: number;
    page?: number;
}

export interface CreateUserDTO {
    username: string;
    name: string;
    password?: string; // Optional if backend generates default, but usually required. Backend requires it.
    role: string;
    departmentId: number;
}

const getUsers = async (params: GetUsersParams) => {
    const response = await client.get('/users', { params });
    return response.data;
};

const createUser = async (data: CreateUserDTO) => {
    const response = await client.post('/users', data);
    return response.data;
};

const updateUser = async (id: number | string, data: Partial<CreateUserDTO>) => {
    const response = await client.patch(`/users/${id}`, data);
    return response.data;
};

const getProfile = async () => {
    const response = await client.get('/users/profile');
    return response.data;
};

const deleteUser = async (id: number | string) => {
    const response = await client.delete(`/users/${id}`);
    return response.data;
};

const updateProfile = async (data: Partial<CreateUserDTO>) => {
    const response = await client.patch('/users/profile', data);
    return response.data;
};

export default {
    getUsers,
    getProfile,
    updateProfile,
    createUser,
    updateUser,
    deleteUser,
};
