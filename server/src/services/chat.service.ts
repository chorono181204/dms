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
                participants: {
                    create: [
                        { userId: id1 },
                        { userId: id2 }
                    ]
                }
            },
        });
    }

    return conversation;
};

/**
 * Create a new group conversation
 */
const createGroup = async (name: string, leaderId: number, participantIds: number[]) => {
    // Ensure leader is in the participants
    const uniqueIds = Array.from(new Set([leaderId, ...participantIds]));

    return prisma.conversation.create({
        data: {
            name,
            leaderId,
            type: 'GROUP',
            participants: {
                create: uniqueIds.map(uid => ({ userId: uid }))
            }
        },
        include: {
            participants: {
                include: {
                    user: {
                        select: { id: true, name: true, username: true }
                    }
                }
            }
        }
    });
};

/**
 * Add participants to a group
 */
const addParticipants = async (conversationId: number, userIds: number[]) => {
    const data = userIds.map(uid => ({
        conversationId,
        userId: uid
    }));

    // Use a transaction and multiple creates since SQLite createMany might be missing in this Prisma version
    return prisma.$transaction(
        userIds.map(uid => prisma.participant.create({
            data: {
                conversationId,
                userId: uid
            }
        }))
    );
};

/**
 * Remove a participant from a group
 */
const removeParticipant = async (conversationId: number, userId: number) => {
    return prisma.participant.delete({
        where: {
            conversationId_userId: {
                conversationId,
                userId
            }
        }
    });
};

/**
 * Delete a conversation (Only if leader or if it's a direct chat being cleaned up)
 */
const deleteConversation = async (conversationId: number) => {
    return prisma.conversation.delete({
        where: { id: conversationId }
    });
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
    // Update conversation updatedAt for sorting
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
    });

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
            sender: {
                select: { id: true, name: true, username: true }
            }
        },
    });
};

/**
 * Get conversations for a user
 * @param {number} userId
 * @returns {Promise<any[]>}
 */
const getConversations = async (userId: number) => {
    const participations = await prisma.participant.findMany({
        where: { userId },
        include: {
            conversation: {
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: {
                            sender: { select: { id: true, name: true, username: true } },
                            attachments: true
                        }
                    },
                    participants: {
                        include: {
                            user: {
                                select: { id: true, name: true, username: true, role: true, departmentId: true, department: { select: { name: true } } }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { conversation: { updatedAt: 'desc' } } as any // Prisma sort might be tricky on nested include
    });

    // Re-sort in JS because Prisma 4.x has limitations on nested sorting in findMany
    const sorted = participations.sort((a, b) =>
        new Date(b.conversation.updatedAt).getTime() - new Date(a.conversation.updatedAt).getTime()
    );

    return sorted.map((p) => {
        const conv = p.conversation;
        let otherUser = null;

        if (conv.type === 'DIRECT') {
            const otherParticipant = conv.participants.find(part => part.userId !== userId);
            otherUser = otherParticipant?.user || null;
        }

        return {
            ...conv,
            otherUser,
            lastMessage: conv.messages[0] || null,
        };
    });
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
        include: {
            attachments: true,
            sender: {
                select: { id: true, name: true, username: true }
            }
        },
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
    createGroup,
    addParticipants,
    removeParticipant,
    deleteConversation,
    sendMessage,
    getConversations,
    getMessages,
};
