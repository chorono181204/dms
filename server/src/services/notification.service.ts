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

        // Emit real-time event
        io.to(`user_${userId}`).emit('receive_notification', notification);
        /* Note: Make sure the socket room logic is set up. 
           If not using rooms per user, iterate or rely on client filtering.
           Currently we check receiverId in client, so we can emit 'new_notification' globally 
           or to specific room if implemented. 
           
           Let's emit 'new_notification' with receiverId to match existing pattern.
        */
        io.emit('new_notification', {
            ...notification,
            receiverId: userId
        });

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
