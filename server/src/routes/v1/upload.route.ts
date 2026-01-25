import express from 'express';
import auth from '../../middlewares/auth';
import uploadController from '../../controllers/upload.controller';
import upload from '../../config/multer';

const router = express.Router();

router.post(
    '/',
    auth(), // Require login to upload (maybe add 'manageTemplates' permission too?)
    upload.single('file'),
    uploadController.uploadFile
);

router.get(
    '/download',
    uploadController.downloadFile
);

router.get(
    '/view',
    uploadController.viewFile
);

export default router;
