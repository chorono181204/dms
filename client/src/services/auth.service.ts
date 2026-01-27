import client from '../api/client';

const changePassword = async (data: any) => {
    const response = await client.post('/auth/change-password', data);
    return response.data;
};

const login = async (username: string, password: string) => {
    const response = await client.post('/auth/login', { username, password });
    if (response.data.tokens) {
        localStorage.setItem('accessToken', response.data.tokens.access.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
};

const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
};

const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    return null;
};

export default {
    login,
    changePassword,
    logout,
    getCurrentUser,
};
