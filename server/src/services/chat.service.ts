import { PrismaClient, Conversation, Message, MessageAttachment } from '@prisma/client';
import prisma from '../client';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

/**
 * Get or create a direct conversation between two users
 * @param {number} user1Id
 * @param {number} user2Id
 * @returns {Promise<Conversation>}
 */
const getOrCreateConversation = async (user1Id: number, user2Id: number): Promise<Conversation> => {
    const [id1, id2] = [user1Id, user2Id].sort((a, b) => a - b);

    let conversation = await prisma.conversation.findUnique({
        where: {
            user1Id_user2Id: {
                user1Id: id1,
                user2Id: id2,
            },
        },
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                user1Id: id1,
                user2Id: id2,
                type: 'DIRECT',
            },
        });
    }

    return conversation;
};

/**
 * Send a message
 * @param {number} conversationId
 * @param {number} senderId
 * @param {string} text
 * @param {string} type
 * @param {any[]} attachments
 * @returns {Promise<Message>}
 */
const sendMessage = async (
    conversationId: number,
    senderId: number,
    text: string | null,
    type: string = 'text',
    attachments: { filePath: string; fileName: string; fileSize: number; fileType: string }[] = []
): Promise<Message & { attachments: MessageAttachment[] }> => {
    return prisma.message.create({
        data: {
            conversationId,
            senderId,
            text,
            type,
            attachments: {
                create: attachments,
            },
        },
        include: {
            attachments: true,
        },
    });
};

/**
 * Get conversations for a user
 * @param {number} userId
 * @returns {Promise<any[]>}
 */
const getConversations = async (userId: number) => {
    const conversations = await prisma.conversation.findMany({
        where: {
            OR: [
                { user1Id: userId },
                { user2Id: userId },
            ],
        },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // Map to include other user info
    return Promise.all(
        conversations.map(async (conv) => {
            const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
            const otherUser = await prisma.user.findUnique({
                where: { id: otherUserId },
                select: { id: true, name: true, username: true, role: true, departmentId: true, department: { select: { name: true } } },
            });
            return {
                ...conv,
                otherUser,
                lastMessage: conv.messages[0] || null,
            };
        })
    );
};

/**
 * Get messages in a conversation
 * @param {number} conversationId
 * @param {number} limit
 * @param {number} page
 * @returns {Promise<any>}
 */
const getMessages = async (conversationId: number, limit: number = 50, page: number = 1) => {
    const skip = (page - 1) * limit;
    const messages = await prisma.message.findMany({
        where: { conversationId },
        include: { attachments: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
    });

    const total = await prisma.message.count({ where: { conversationId } });

    return {
        results: messages.reverse(),
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
    };
};

export default {
    getOrCreateConversation,
    sendMessage,
    getConversations,
    getMessages,
};
