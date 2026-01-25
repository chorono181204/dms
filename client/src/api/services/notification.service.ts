import axiosClient from '../client';

export interface Notification {
    id: number;
    title: string;
    content: string;
    type: 'SYSTEM' | 'TASK' | 'DOCUMENT';
    link: string;
    isRead: boolean;
    createdAt: string;
}

export const getNotifications = async (limit: number = 20, offset: number = 0) => {
    const response = await axiosClient.get('/notifications', { params: { limit, offset } });
    return response.data; // { notifications: [], unreadCount: 0 }
};

export const markAsRead = async (id: number) => {
    await axiosClient.patch(`/notifications/${id}/read`);
};

export const markAllAsRead = async () => {
    await axiosClient.patch('/notifications/read-all');
};

export const notificationService = {
    getNotifications,
    markAsRead,
    markAllAsRead
};
