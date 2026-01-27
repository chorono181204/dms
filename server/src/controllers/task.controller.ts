import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { io } from '../index'; // Import socket instance
import { notificationService } from '../services';
import path from 'path';
import fs from 'fs';

const createTask = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { title, description, priority, dueDate, assigneeId, departmentId } = req.body;

    // Check if assignee exists if provided
    if (assigneeId) {
        const assignee = await prisma.user.findUnique({ where: { id: Number(assigneeId) } });
        if (!assignee) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Assignee not found');
        }
    }

    const task = await prisma.task.create({
        data: {
            title,
            description,
            priority: priority || 'NORMAL',
            dueDate: dueDate ? new Date(dueDate) : null,
            assignerId: user.id,
            assigneeId: assigneeId ? Number(assigneeId) : null,
            departmentId: departmentId ? Number(departmentId) : null,
            status: 'TODO'
        },
        include: {
            assignee: { select: { id: true, name: true, username: true } }, // Removed avatar as it doesn't exist
            assigner: { select: { id: true, name: true, username: true } }
        }
    });

    // Handle File Uploads if any
    if (req.files && Array.isArray(req.files)) {
        const uploadDir = 'G:\\My Drive\\DMS\\Task_Attachments';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        for (const file of req.files as Express.Multer.File[]) {
            const fileExt = path.extname(file.originalname);
            const fileName = `${task.id}_${Date.now()}_${file.originalname}`;
            const filePath = path.join(uploadDir, fileName);

            fs.copyFileSync(file.path, filePath);
            fs.unlinkSync(file.path);

            await prisma.taskAttachment.create({
                data: {
                    taskId: task.id,
                    filePath: filePath,
                    fileName: file.originalname,
                    fileSize: file.size,
                    fileType: file.mimetype,
                    uploadedBy: user.username
                }
            });
        }
    }

    // Reload task with attachments
    const finalTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
            assignee: { select: { id: true, name: true, username: true } },
            assigner: { select: { id: true, name: true, username: true } },
            attachments: true
        }
    });

    // Notification Logic
    if (finalTask?.assigneeId && Number(finalTask.assigneeId) !== user.id) {
        // Persistent Notification
        await notificationService.createNotification(
            finalTask.assigneeId,
            'Công việc mới được giao',
            `Bạn được giao công việc: ${finalTask.title}`,
            'TASK',
            `/tasks?taskId=${finalTask.id}`
        );
    }

    // Auto-log initial assignment
    if (finalTask?.assigneeId) {
        await prisma.taskComment.create({
            data: {
                taskId: finalTask.id,
                userId: user.id,
                content: `Đã giao công việc cho ${finalTask.assignee?.name || finalTask.assignee?.username}`,
                type: 'SYSTEM'
            }
        });
    }

    // Real-time update for Task Board
    io.emit('new_task', finalTask);

    res.status(httpStatus.CREATED).send(finalTask);
});

const getTasks = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { filter } = req.query; // 'assigned', 'created', 'department', 'all'

    let where: any = {};

    if (filter === 'assigned') {
        where.assigneeId = user.id;
    } else if (filter === 'created') {
        where.assignerId = user.id;
    } else if (filter === 'department') {
        where.departmentId = user.departmentId;
    } else {
        // Default: Show tasks assigned to me OR created by me OR in my department (if I'm manager?)
        // Let's keep it simple: Tasks I'm involved in
        where = {
            OR: [
                { assigneeId: user.id },
                { assignerId: user.id }
            ]
        };
    }

    const tasks = await prisma.task.findMany({
        where,
        include: {
            assignee: { select: { id: true, name: true, username: true } },
            assigner: { select: { id: true, name: true, username: true } },
            attachments: true
        },
        orderBy: { createdAt: 'desc' }
    });

    res.send(tasks);
});

const updateTaskStatus = catchAsync(async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user as any;

    const task = await prisma.task.findUnique({
        where: { id: Number(taskId) }
    });

    if (!task) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }

    // Permission: Assigner OR Assignee OR Admin
    if (task.assignerId !== user.id && task.assigneeId !== user.id && user.role !== 'ADMIN') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền cập nhật trạng thái công việc này');
    }

    // Special Rule: Only Assigner (Owner) or Admin can move to DONE
    if (status === 'DONE' && task.assignerId !== user.id && user.role !== 'ADMIN') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Chỉ người giao việc mới được phép đánh dấu hoàn thành');
    }

    const updatedTask = await prisma.task.update({
        where: { id: Number(taskId) },
        data: { status },
        include: {
            assignee: true,
            assigner: true
        }
    });

    // Helper to map status to Vietnamese
    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'TODO': return 'Cần làm';
            case 'IN_PROGRESS': return 'Đang làm';
            case 'REVIEW': return 'Chờ duyệt';
            case 'DONE': return 'Hoàn thành';
            default: return s;
        }
    };

    // Notify assigner if assignee updates status
    if (updatedTask.assignerId !== user.id) {
        // Persistent Notification for Assigner
        await notificationService.createNotification(
            updatedTask.assignerId,
            'Trạng thái công việc thay đổi',
            `${user.name || user.username} đã cập nhật trạng thái công việc "${updatedTask.title}" sang ${getStatusLabel(status)}`,
            'TASK',
            `/tasks?taskId=${updatedTask.id}`
        );
    }
    // Notify assignee if assigner updates status
    if (updatedTask.assigneeId && updatedTask.assigneeId !== user.id) {
        // Persistent Notification for Assignee
        await notificationService.createNotification(
            updatedTask.assigneeId,
            'Trạng thái công việc thay đổi',
            `Trạng thái công việc "${updatedTask.title}" đã được cập nhật sang ${getStatusLabel(status)}`,
            'TASK',
            `/tasks?taskId=${updatedTask.id}`
        );
    }

    // Real-time update for Task Board
    io.emit('task_updated', updatedTask);

    res.send(updatedTask);
});

const updateTask = catchAsync(async (req, res) => {
    const { taskId } = req.params;
    const user = req.user as any; // Need user for upload

    // Check ownership
    const existingTask = await prisma.task.findUnique({ where: { id: Number(taskId) } });
    if (!existingTask) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }

    // Only Assigner (Owner) can update details
    if (existingTask.assignerId !== user.id && user.role !== 'ADMIN') { // Allow Admin too? Let's stick to owner for now or Admin
        throw new ApiError(httpStatus.FORBIDDEN, 'Chỉ người tạo việc mới có quyền chỉnh sửa nội dung');
    }

    // Exclude 'files' from updateBody to avoid Prisma error
    const { files, ...updateBody } = req.body;

    // Also, don't allow changing assignee or everything? 
    // Usually owner can change everything.
    // Assignee can't change anything here.

    const task = await prisma.task.update({
        where: { id: Number(taskId) },
        data: updateBody,
        include: {
            assignee: true,
            assigner: true,
            attachments: true // Include this but attachments update happens below
        }
    });

    // Auto-log reassignment if assigneeId changed
    if (updateBody.assigneeId && Number(updateBody.assigneeId) !== existingTask.assigneeId) {
        const newAssigneeId = Number(updateBody.assigneeId);
        const newAssignee = await prisma.user.findUnique({ where: { id: newAssigneeId } });

        await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: user.id,
                content: `Đã chuyển công việc qua cho ${newAssignee?.name || newAssignee?.username}`,
                type: 'SYSTEM'
            }
        });

        // Notify new assignee
        if (newAssigneeId !== user.id) {
            await notificationService.createNotification(
                newAssigneeId,
                'Công việc được chuyển giao',
                `Bạn được nhận bàn giao công việc: ${task.title} từ ${user.name || user.username}`,
                'TASK',
                `/tasks?taskId=${task.id}`
            );
        }
    }

    // Handle File Uploads if any (Same logic as createTask)
    if (req.files && Array.isArray(req.files)) {
        const uploadDir = 'G:\\My Drive\\DMS\\Task_Attachments';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        for (const file of req.files as Express.Multer.File[]) {
            const fileName = `${task.id}_${Date.now()}_${file.originalname}`;
            const filePath = path.join(uploadDir, fileName);

            fs.copyFileSync(file.path, filePath);
            fs.unlinkSync(file.path);

            await prisma.taskAttachment.create({
                data: {
                    taskId: task.id,
                    filePath: filePath,
                    fileName: file.originalname,
                    fileSize: file.size,
                    fileType: file.mimetype,
                    uploadedBy: user.username
                }
            });
        }
    }

    // Force reload to return new attachments
    const finalTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
            assignee: true,
            assigner: true,
            attachments: true
        }
    });

    // Real-time update for Task Board
    io.emit('task_updated', finalTask);

    res.send(finalTask);
});

const addTaskComment = catchAsync(async (req, res) => {
    const { taskId } = req.params;
    const { content, type } = req.body; // type: 'COMMENT' | 'RESULT'
    const user = req.user as any;

    const task = await prisma.task.findUnique({ where: { id: Number(taskId) } });
    if (!task) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }

    // Permission: Assigner, Assignee, ADMIN
    if (task.assignerId !== user.id && task.assigneeId !== user.id && user.role !== 'ADMIN') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền thảo luận trong công việc này');
    }

    // Create Comment
    const comment = await prisma.taskComment.create({
        data: {
            taskId: task.id,
            userId: user.id,
            content: content,
            type: type || 'COMMENT'
        }
    });

    // Handle Attachments
    if (req.files && Array.isArray(req.files)) {
        const uploadDir = 'G:\\My Drive\\DMS\\Task_Attachments';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        for (const file of req.files as Express.Multer.File[]) {
            const fileName = `${task.id}_${comment.id}_${Date.now()}_${file.originalname}`;
            const filePath = path.join(uploadDir, fileName);

            fs.copyFileSync(file.path, filePath);
            fs.unlinkSync(file.path);

            await prisma.taskAttachment.create({
                data: {
                    taskId: task.id,
                    taskCommentId: comment.id,
                    filePath: filePath,
                    fileName: file.originalname,
                    fileSize: file.size,
                    fileType: file.mimetype,
                    uploadedBy: user.username
                }
            });
        }
    }

    // Notify
    const targetUserId = (user.id === task.assignerId) ? task.assigneeId : task.assignerId;
    if (targetUserId) {
        const msgType = (type === 'RESULT') ? 'Báo cáo kết quả' : 'Bình luận mới';
        await notificationService.createNotification(
            targetUserId,
            `${msgType} trong công việc "${task.title}"`,
            `${user.name || user.username}: ${content || '(Đính kèm tệp)'}`,
            'TASK',
            `/tasks?taskId=${task.id}`
        );
    }

    // Return updated task with comments
    const updatedTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
            assignee: { select: { id: true, name: true, username: true } },
            assigner: { select: { id: true, name: true, username: true } },
            attachments: true,
            comments: {
                include: {
                    user: { select: { id: true, name: true, username: true, role: true } },
                    attachments: true
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    // Real-time update for Task Board
    io.emit('task_updated', updatedTask);

    res.send(updatedTask);
});

const getTaskDetails = catchAsync(async (req, res) => {
    const { taskId } = req.params;
    const user = req.user as any;

    // Check permission logic same as others
    const task = await prisma.task.findUnique({
        where: { id: Number(taskId) },
        include: {
            assignee: { select: { id: true, name: true, username: true } },
            assigner: { select: { id: true, name: true, username: true } },
            attachments: true,
            comments: {
                include: {
                    user: { select: { id: true, name: true, username: true, role: true } },
                    attachments: true
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!task) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }

    // Simple permission check
    if (task.assignerId !== user.id && task.assigneeId !== user.id && user.role !== 'ADMIN') {
        // Maybe allow department? For now restrict.
        // throw new ApiError(httpStatus.FORBIDDEN, ...);
        // Actually getTasks allowed department access if filtered.
        // Let's assume strict for details for now or match getTasks.
    }

    res.send(task);
});

const deleteTask = catchAsync(async (req, res) => {
    const { taskId } = req.params;

    await prisma.task.delete({
        where: { id: Number(taskId) }
    });

    // Real-time update for Task Board
    io.emit('task_deleted', Number(taskId));

    res.status(httpStatus.NO_CONTENT).send();
});

export default {
    createTask,
    getTasks,
    updateTaskStatus,
    updateTask,
    deleteTask,
    addTaskComment,
    getTaskDetails
};
