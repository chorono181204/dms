import client from '../client';

const endpoint = '/chat';

export const getConversations = async () => {
    const response = await client.get(`${endpoint}/conversations`);
    return response.data;
};

export const getOrCreateConversation = async (otherUserId: number) => {
    const response = await client.post(`${endpoint}/conversations`, { otherUserId });
    return response.data;
};

export const getMessages = async (conversationId: number, params?: any) => {
    const response = await client.get(`${endpoint}/messages/${conversationId}`, { params });
    return response.data;
};

export const sendMessage = async (data: FormData) => {
    const response = await client.post(`${endpoint}/messages`, data, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};
