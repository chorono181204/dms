import axios from 'axios';
import { getApiUrl } from '../utils/config';

const client = axios.create({
    baseURL: getApiUrl(),
    // headers: {
    //     'Content-Type': 'application/json', // Removing this allows Axios to set correct Content-Type for FormData
    // },
});

client.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default client;
