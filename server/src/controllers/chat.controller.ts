import httpStatus from 'http-status';
import path from 'path';
import fs from 'fs';
import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import chatService from '../services/chat.service';
import pick from '../utils/pick';
import { io } from '../index';

// Helper to get upload root (consistent with document controller)
const getUploadRoot = () => {
    const PREFERRED_ROOT = 'G:\\DMS_DATA';
    const GDRIVE_ROOT = 'G:\\My Drive\\DMS';
    const FALLBACK_ROOT = path.join(__dirname, '../../uploads');

    try {
        if (fs.existsSync('G:\\')) {
            if (fs.existsSync('G:\\My Drive')) {
                return GDRIVE_ROOT;
            }
            return PREFERRED_ROOT;
        }
    } catch (e) { }
    return FALLBACK_ROOT;
};

const getChatUploadDir = () => {
    const root = getUploadRoot();
    const chatDir = path.join(root, 'Chat_Uploads');
    if (!fs.existsSync(chatDir)) {
        fs.mkdirSync(chatDir, { recursive: true });
    }
    return chatDir;
};

const getConversations = catchAsync(async (req, res) => {
    const user = req.user as any;
    const conversations = await chatService.getConversations(user.id);
    res.send(conversations);
});

const getOrCreateConversation = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { otherUserId } = req.body;
    if (!otherUserId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'otherUserId is required');
    }
    const conversation = await chatService.getOrCreateConversation(user.id, parseInt(otherUserId));
    res.send(conversation);
});

const getMessages = catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const options = pick(req.query, ['limit', 'page']);
    const limit = options.limit ? parseInt(options.limit as string) : 50;
    const page = options.page ? parseInt(options.page as string) : 1;

    const messages = await chatService.getMessages(parseInt(conversationId), limit, page);
    res.send(messages);
});

const createGroup = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { name, participantIds } = req.body;
    if (!name || !participantIds) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'name and participantIds are required');
    }
    const conversation = await chatService.createGroup(name, user.id, participantIds);

    // Notify all participants via their personal rooms to join this group room
    participantIds.forEach((pid: number) => {
        io.to(`user_${pid}`).emit('added_to_group', conversation.id);
    });

    res.status(httpStatus.CREATED).send(conversation);
});

const addParticipants = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { conversationId, userIds } = req.body;

    // Check if user is leader (or allow admin?)
    const convoObj = await chatService.getConversations(user.id);
    const conv = convoObj.find((c: any) => c.id === parseInt(conversationId));
    if (!conv || (conv.leaderId !== user.id && user.role !== 'ADMIN')) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only leader can add participants');
    }

    await chatService.addParticipants(parseInt(conversationId), userIds);

    // Notify new participants
    userIds.forEach((pid: number) => {
        io.to(`user_${pid}`).emit('added_to_group', conversationId);
    });

    // Notify existing participants (including the leader) that the group has been updated
    io.to(`conv_${conversationId}`).emit('conversation_updated', { conversationId });

    res.status(httpStatus.NO_CONTENT).send();
});

const removeParticipant = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { conversationId, userId } = req.body;

    const convoObj = await chatService.getConversations(user.id);
    const conv = convoObj.find((c: any) => c.id === parseInt(conversationId));
    if (!conv || (conv.leaderId !== user.id && user.role !== 'ADMIN')) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only leader can remove participants');
    }

    await chatService.removeParticipant(parseInt(conversationId), parseInt(userId));

    // Notify group about update
    io.to(`conv_${conversationId}`).emit('conversation_updated', { conversationId });
    // Also notify removed user? They won't receive it if they are removed from room/db access check,
    // but socket room removal logic is separate. Ideally strict sync.

    res.status(httpStatus.NO_CONTENT).send();
});

const deleteConversation = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { conversationId } = req.params;

    const convoObj = await chatService.getConversations(user.id);
    const conv = convoObj.find((c: any) => c.id === parseInt(conversationId));
    if (!conv || (conv.leaderId !== user.id && user.role !== 'ADMIN')) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only leader can delete the conversation');
    }

    await chatService.deleteConversation(parseInt(conversationId));
    res.status(httpStatus.NO_CONTENT).send();
});

const sendMessage = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { conversationId, text, type } = req.body;
    const files = req.files as Express.Multer.File[];

    // File logging skipped for brevity but kept in mind...

    if (!conversationId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'conversationId is required');
    }

    const attachments: any[] = [];
    if (files && files.length > 0) {
        const uploadDir = getChatUploadDir();
        for (const file of files) {
            // FIX: Decode originalname from latin1 to utf8 to handle Vietnamese characters correctly
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

            const ext = path.extname(file.originalname);
            const finalFilename = `chat_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
            const targetPath = path.join(uploadDir, finalFilename);
            try {
                fs.renameSync(file.path, targetPath);
            } catch (e: any) {
                if (e.code === 'EXDEV') {
                    fs.copyFileSync(file.path, targetPath);
                    fs.unlinkSync(file.path);
                } else {
                    throw e;
                }
            }
            attachments.push({
                filePath: targetPath,
                fileName: file.originalname,
                fileSize: file.size,
                fileType: file.mimetype,
            });
        }
    }

    const message = await chatService.sendMessage(
        parseInt(conversationId),
        user.id,
        text,
        type || (attachments.length > 0 ? 'file' : 'text'),
        attachments
    );

    // CRITICAL: Emit to context room instead of specific user
    io.to(`conv_${conversationId}`).emit('receive_message', message);

    res.status(httpStatus.CREATED).send(message);
});

export default {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    createGroup,
    addParticipants,
    removeParticipant,
    deleteConversation,
};
