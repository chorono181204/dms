import express from 'express';
import auth from '../../middlewares/auth';
import chatController from '../../controllers/chat.controller';
import upload from '../../config/multer';

const router = express.Router();

router.get('/conversations', auth('manageDocuments'), chatController.getConversations);
router.post('/conversations', auth('manageDocuments'), chatController.getOrCreateConversation);

router.get('/messages/:conversationId', auth('manageDocuments'), chatController.getMessages);
router.post('/messages', auth('manageDocuments'), upload.array('files', 10), chatController.sendMessage);

export default router;
