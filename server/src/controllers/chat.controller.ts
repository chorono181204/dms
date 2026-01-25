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

const sendMessage = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { conversationId, text, type } = req.body;
    const files = req.files as Express.Multer.File[];

    // File logging
    const logPath = path.join(process.cwd(), 'chat_debug.log');
    const logMsg = `[${new Date().toISOString()}] User:${user.id} Conv:${conversationId} Text:${text} Files:${files ? files.length : 0}\n`;
    fs.appendFileSync(logPath, logMsg);
    if (files) {
        files.forEach((f, i) => {
            fs.appendFileSync(logPath, `File ${i}: ${f.originalname} (${f.mimetype}) Size:${f.size}\n`);
        });
    }

    if (!conversationId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'conversationId is required');
    }

    const attachments: any[] = [];
    if (files && files.length > 0) {
        const uploadDir = getChatUploadDir();

        for (const file of files) {
            const ext = path.extname(file.originalname);
            const finalFilename = `chat_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
            const targetPath = path.join(uploadDir, finalFilename);

            // Move file
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

    // Emit socket event to the recipient
    const convoObj = await chatService.getConversations(user.id);
    const currentConvo = convoObj.find((c: any) => c.id === parseInt(conversationId));

    if (currentConvo && currentConvo.otherUser) {
        const otherUserId = currentConvo.otherUser.id;
        io.to(`user_${otherUserId}`).emit('receive_message', message);
    }

    res.status(httpStatus.CREATED).send(message);
});

export default {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
};
