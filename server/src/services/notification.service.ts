import prisma from '../client';
import { io } from '../index';

/**
 * Create a persistent notification and emit it to the user via socket
 */
const createNotification = async (
    userId: number,
    title: string,
    content: string,
    type: string = 'SYSTEM',
    link: string = ''
) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                content,
                type,
                link,
                isRead: false
            }
        });

        // Emit real-time event ONLY to the specific user's room
        io.to(`user_${userId}`).emit('receive_notification', notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

const getUserNotifications = async (userId: number, limit: number = 20, offset: number = 0) => {
    const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
    });

    const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false }
    });

    return { notifications, unreadCount };
};

const markAsRead = async (id: number, userId: number) => {
    return prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true }
    });
};

const markAllAsRead = async (userId: number) => {
    return prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
    });
};

export default {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead
};
