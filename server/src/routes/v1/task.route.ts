import express from 'express';
import validate from '../../middlewares/validate';
import { taskValidation } from '../../validations';
import taskController from '../../controllers/task.controller';
import auth from '../../middlewares/auth';
import { uploadMiddleware } from '../../controllers/upload.controller'; // Reuse upload middleware

const router = express.Router();

router
    .route('/')
    .post(auth(), uploadMiddleware, validate(taskValidation.createTask), taskController.createTask)
    .get(auth(), validate(taskValidation.getTasks), taskController.getTasks);

router
    .route('/:taskId/status')
    .patch(auth(), validate(taskValidation.updateTaskStatus), taskController.updateTaskStatus);

router
    .route('/:taskId')
    .patch(auth(), uploadMiddleware, validate(taskValidation.updateTask), taskController.updateTask)
    .delete(auth(), validate(taskValidation.deleteTask), taskController.deleteTask)
    .get(auth(), taskController.getTaskDetails);

router
    .route('/:taskId/attachments/:attachmentId')
    .delete(auth(), taskController.deleteTaskAttachment);

router
    .route('/:taskId/comments')
    .post(auth(), uploadMiddleware, taskController.addTaskComment);

export default router;
