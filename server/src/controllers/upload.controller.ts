import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import fs from 'fs';
import path from 'path';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { applyWatermark, WatermarkType } from '../utils/pdfWatermark';
import mime from 'mime-types';
import tokenService from '../services/token.service';
import userService from '../services/user.service';
import { TokenType } from '../config/tokens';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

/**
 * Helper to manually verify token if req.user is missing

/**
 * Helper to manually verify token if req.user is missing
 */
const authenticateRequest = async (req: any) => {
    if (req.user) return req.user;

    const token = req.query.token as string;
    if (!token) return null;

    try {
        const tokenDoc = await tokenService.verifyToken(token, TokenType.ACCESS);
        if (tokenDoc) {
            return await userService.getUserById(tokenDoc.userId);
        }
    } catch (error) {
        console.error('Manual token verification failed:', error);
    }
    return null;
};

const uploadFile = catchAsync(async (req, res) => {
    if (!req.file) {
        res.status(httpStatus.BAD_REQUEST).send({ message: 'No file uploaded' });
        return;
    }

    const category = req.body.category || 'Chưa phân loại';
    const name = req.body.name || 'Untitled';

    // Target structure: G:\My Drive\DMS\{category}\Mẫu
    const targetRoot = 'G:\\My Drive\\DMS';
    const targetDir = path.join(targetRoot, category, 'Mẫu');

    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Use the provided Name for the filename, keeping original extension
        const ext = path.extname(req.file.originalname); // .docx
        const safeName = name.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ \-_]/g, '_');
        const finalFilename = `${safeName}${ext}`;
        const targetPath = path.join(targetDir, finalFilename);

        // Move file
        try {
            fs.renameSync(req.file.path, targetPath);
        } catch (e: any) {
            if (e.code === 'EXDEV') {
                fs.copyFileSync(req.file.path, targetPath);
                fs.unlinkSync(req.file.path);
            } else {
                throw e;
            }
        }

        res.status(httpStatus.OK).send({
            url: targetPath, // We still save the absolute path internally
            filename: finalFilename
        });

    } catch (error) {
        console.error('Error saving file to G drive:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            message: 'Could not save file to G: Drive.',
            error: error
        });
    }
});

const downloadFile = catchAsync(async (req, res) => {
    const filePath = req.query.path as string;
    const isInline = req.query.inline === 'true';
    let user = req.user as any;

    // Manually verify token if not already authenticated (needed for direct URL access)
    if (!user) {
        user = await authenticateRequest(req);
    }

    if (!fs.existsSync(filePath)) {
        res.status(httpStatus.NOT_FOUND).send({ message: 'File not found' });
        return;
    }

    const isChatUpload = filePath.includes('Chat_Uploads');

    // For non-chat files, require authentication
    if (!isChatUpload && !user) {
        res.status(httpStatus.UNAUTHORIZED).send({ message: 'Please authenticate' });
        return;
    }

    // Permission check for non-Admin users (only for non-chat files)
    if (!isChatUpload && user && user.role !== 'ADMIN') {
        // 1. Try to find the document this file belongs to
        let doc = await prisma.document.findFirst({
            where: { content: filePath },
            include: { permissions: true }
        });

        // 2. If not found in main content, check versions
        if (!doc) {
            const version = await prisma.documentVersion.findFirst({
                where: { filePath: filePath }
            });
            if (version) {
                doc = await prisma.document.findUnique({
                    where: { id: version.documentId },
                    include: { permissions: true }
                });
            }
        }

        // 3. If it's a document file, enforce permissions
        if (doc) {
            const isOwner = doc.createdBy === user.username;
            const isSupervisory = user.department?.isSupervisory;
            const userPermission = doc.permissions?.find((p: any) => Number(p.userId) === Number(user.id));

            // View check: Owner, Supervisor (for DEPARTMENT/PUBLIC), Explicit Permission, or Public visibility, or same department
            const canView = isOwner || userPermission ||
                (doc.visibility === 'PUBLIC') ||
                (doc.visibility === 'DEPARTMENT' && (doc.departmentId === user.departmentId || isSupervisory));

            if (!canView) {
                throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
            }

            if (!isInline) {
                // Additional Download Check
                const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT' || userPermission?.permission === 'SIGN';

                // Can download if owner, has explicit permission, 
                // OR if it's not PRIVATE and NOT set to VIEW-only accessLevel
                const canDownload = isOwner || hasExplicitDownload ||
                    (doc.visibility !== 'PRIVATE' && doc.accessLevel !== 'VIEW');

                if (!canDownload) {
                    throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền tải xuống tài liệu này');
                }
            }
        }
    }

    // Dynamic Watermark Logic
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        // Find the document to get its status
        const doc = await prisma.document.findFirst({
            where: { content: filePath },
            include: { department: true }
        }) as any;

        if (doc) {
            let watermarkType: WatermarkType | null = null;
            const isExpired = doc.expirationDate && new Date(doc.expirationDate) < new Date();

            if (isExpired) {
                watermarkType = WatermarkType.OBSOLETE;
            } else if (doc.isReference) {
                watermarkType = WatermarkType.REFERENCE;
            } else if (doc.status === 'DRAFT' || doc.status === 'PENDING') {
                watermarkType = WatermarkType.DRAFT;
            } else if (doc.status === 'APPROVED' || doc.status === 'SIGNED') {
                watermarkType = WatermarkType.APPROVED;
            } else if (doc.status === 'ARCHIVED' || doc.status === 'REJECTED') {
                watermarkType = WatermarkType.OBSOLETE;
            }

            if (watermarkType || doc.visibility) {
                try {
                    const pdfBuffer = fs.readFileSync(filePath);
                    const modifiedPdf = await applyWatermark(pdfBuffer, {
                        type: watermarkType || WatermarkType.DRAFT, // Fallback if visibility but no type
                        effectiveDate: doc.effectiveDate || doc.createdAt,
                        obsoleteDate: doc.updatedAt,
                        departmentName: doc.department?.name,
                        visibility: doc.visibility
                    });

                    res.setHeader('Content-Type', 'application/pdf');
                    if (isInline) {
                        res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
                    } else {
                        res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(filePath) + '"');
                    }
                    res.send(Buffer.from(modifiedPdf));
                    return;
                } catch (error) {
                    console.error('Error applying watermark:', error);
                    // Fallback to normal download if watermarking fails
                }
            }
        }
    }

    if (isInline) {
        res.setHeader('Content-Security-Policy', "");
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.sendFile(path.resolve(filePath));
    } else {
        res.download(path.resolve(filePath));
    }
});

const viewFile = catchAsync(async (req, res) => {
    const filePath = req.query.path as string;
    const user = req.user as any;

    if (!fs.existsSync(filePath)) {
        res.status(httpStatus.NOT_FOUND).send({ message: 'File not found' });
        return;
    }

    // Special handling for Chat Uploads - serve immediately without auth
    const isChatUpload = filePath.includes('Chat_Uploads');
    if (isChatUpload) {
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline');
        res.sendFile(filePath);
        return;
    }

    // For non-chat files, require authentication
    if (!user) {
        res.status(httpStatus.UNAUTHORIZED).send({ message: 'Please authenticate' });
        return;
    }

    // Permission check for non-Admin users
    if (user.role !== 'ADMIN') {
        // 1. Try to find the document this file belongs to
        let doc = await prisma.document.findFirst({
            where: { content: filePath },
            include: { permissions: true }
        });

        // 2. If not found in main content, check versions
        if (!doc) {
            const version = await prisma.documentVersion.findFirst({
                where: { filePath: filePath }
            });
            if (version) {
                doc = await prisma.document.findUnique({
                    where: { id: version.documentId },
                    include: { permissions: true }
                });
            }
        }

        // 3. If it's a document file, enforce permissions
        if (doc) {
            const isOwner = doc.createdBy === user.username;
            const isSupervisory = user.department?.isSupervisory;
            const userPermission = doc.permissions?.find((p: any) => Number(p.userId) === Number(user.id));

            // View check: Owner, Supervisor (for DEPARTMENT/PUBLIC), Explicit Permission, or Public visibility, or same department
            const canView = isOwner || userPermission ||
                (doc.visibility === 'PUBLIC') ||
                (doc.visibility === 'DEPARTMENT' && (doc.departmentId === user.departmentId || isSupervisory));

            if (!canView) {
                throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
            }
        }
    }

    // Dynamic Watermark Logic (Same as download but inline)
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf' && !isChatUpload) { // Skip watermark for chat for now? Or keep it? Chat usually raw files.
        // Find the document to get its status
        const doc = await prisma.document.findFirst({
            where: { content: filePath },
            include: { department: true }
        }) as any;

        if (doc) {
            let watermarkType: WatermarkType | null = null;
            const isExpired = doc.expirationDate && new Date(doc.expirationDate) < new Date();

            if (isExpired) {
                watermarkType = WatermarkType.OBSOLETE;
            } else if (doc.isReference) {
                watermarkType = WatermarkType.REFERENCE;
            } else if (doc.status === 'DRAFT' || doc.status === 'PENDING') {
                watermarkType = WatermarkType.DRAFT;
            } else if (doc.status === 'APPROVED' || doc.status === 'SIGNED') {
                watermarkType = WatermarkType.APPROVED;
            } else if (doc.status === 'ARCHIVED' || doc.status === 'REJECTED') {
                watermarkType = WatermarkType.OBSOLETE;
            }

            if (watermarkType || doc.visibility) {
                try {
                    const pdfBuffer = fs.readFileSync(filePath);
                    const modifiedPdf = await applyWatermark(pdfBuffer, {
                        type: watermarkType || WatermarkType.DRAFT, // Fallback if visibility but no type
                        effectiveDate: doc.effectiveDate || doc.createdAt,
                        obsoleteDate: doc.updatedAt,
                        departmentName: doc.department?.name,
                        visibility: doc.visibility
                    });

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
                    res.setHeader('Content-Security-Policy', ""); // Allow displaying in img tag
                    res.setHeader('X-Frame-Options', 'ALLOWALL');
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    res.send(Buffer.from(modifiedPdf));
                    return;
                } catch (error) {
                    console.error('Error applying watermark:', error);
                    // Fallback to normal display if watermarking fails
                }
            }
        }
    }

    // Serve file inline
    res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
    res.setHeader('Content-Security-Policy', ""); // Allow displaying in img tag
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set correct Content-Type based on extension
    if (ext === '.png') res.setHeader('Content-Type', 'image/png');
    else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
    else if (ext === '.gif') res.setHeader('Content-Type', 'image/gif');
    else if (ext === '.pdf') res.setHeader('Content-Type', 'application/pdf');

    res.sendFile(path.resolve(filePath));
});

export const uploadMiddleware = upload.array('files');

export default {
    uploadFile,
    downloadFile,
    viewFile
};
