import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { notificationService } from '../services';

const getNotifications = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { limit, offset } = req.query;

    const result = await notificationService.getUserNotifications(
        user.id,
        limit ? Number(limit) : 20,
        offset ? Number(offset) : 0
    );

    res.send(result);
});

const markAsRead = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { notificationId } = req.params;

    await notificationService.markAsRead(Number(notificationId), user.id);
    res.status(httpStatus.NO_CONTENT).send();
});

const markAllAsRead = catchAsync(async (req, res) => {
    const user = req.user as any;

    await notificationService.markAllAsRead(user.id);
    res.status(httpStatus.NO_CONTENT).send();
});

export default {
    getNotifications,
    markAsRead,
    markAllAsRead
};
