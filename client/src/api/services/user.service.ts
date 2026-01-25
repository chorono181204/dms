import client from '../client';
import { getApiUrl } from '../../utils/config';

const API_URL = getApiUrl();

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return { Authorization: `Bearer ${token}` };
};

export const getUsers = async (params?: any) => {
    const response = await client.get('/users', {
        params
    });
    return response.data;
};

export const searchUsers = async (query: string) => {
    return getUsers({ name: query, scope: 'all', limit: 20 });
};
