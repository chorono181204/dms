import express from 'express';
import auth from '../../middlewares/auth';
import notificationController from '../../controllers/notification.controller';

const router = express.Router();

router.use(auth()); // All notification routes require auth

router
    .route('/')
    .get(notificationController.getNotifications);

router
    .route('/:notificationId/read')
    .patch(notificationController.markAsRead);

router
    .route('/read-all')
    .patch(notificationController.markAllAsRead);

export default router;
