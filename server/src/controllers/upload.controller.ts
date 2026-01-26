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
import { convertFileToPdf, isConvertibleFile } from '../services/conversion.service';
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

// Helper to fix UTF-8 encoding for fields coming from Multer/Busboy (defaults to latin1)
const decodeUTF8 = (val: any) => {
    if (typeof val !== 'string') return val;
    try {
        return Buffer.from(val, 'latin1').toString('utf8');
    } catch (e) {
        return val;
    }
};

/**
 * Helper to manually verify token if req.user is missing
 */
const authenticateRequest = async (req: any) => {
    if (req.user) return req.user;

    let token = req.query.token as string;
    console.log('authenticateRequest: query token present:', !!token);

    // Check for Bearer token in Authorization header if query token is missing
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
            console.log('authenticateRequest: found Bearer token in header');
        }
    }

    if (!token) {
        console.log('authenticateRequest: NO TOKEN FOUND');
        return null;
    }

    try {
        const tokenDoc = await tokenService.verifyToken(token, TokenType.ACCESS);
        if (tokenDoc) {
            const user = await userService.getUserById(tokenDoc.userId);
            if (user) {
                console.log('authenticateRequest: User authenticated via token:', user.username);
                return user;
            }
        }
    } catch (error) {
        console.error('Manual token verification failed:', error);
    }
    console.log('authenticateRequest: Authentication failed or token invalid');
    return null;
};

const uploadFile = catchAsync(async (req, res) => {
    if (!req.file) {
        res.status(httpStatus.BAD_REQUEST).send({ message: 'No file uploaded' });
        return;
    }

    const category = decodeUTF8(req.body.category) || 'Chưa phân loại';
    const name = decodeUTF8(req.body.name) || 'Untitled';

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
            let canView = isOwner || userPermission ||
                (doc.visibility === 'PUBLIC') ||
                (doc.visibility === 'DEPARTMENT' && (doc.departmentId === user.departmentId || isSupervisory));

            // Also check if user has an active Signature Request (allow viewing to sign)
            let hasSignatureRequest = false;
            if (!canView) {
                const sigReq = await prisma.signatureRequest.findFirst({
                    where: {
                        documentId: doc.id,
                        userId: user.id,
                    }
                });
                if (sigReq) {
                    canView = true;
                    hasSignatureRequest = true;
                }
            }

            if (!canView) {
                throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
            }

            if (!isInline) {
                // Additional Download Check
                const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT' || userPermission?.permission === 'SIGN';

                // Can download if owner, has explicit permission, or has a signature request
                // OR if it's not PRIVATE and NOT set to VIEW-only accessLevel
                const canDownload = isOwner || hasExplicitDownload || hasSignatureRequest ||
                    (doc.visibility !== 'PRIVATE' && doc.accessLevel !== 'VIEW');

                if (!canDownload) {
                    throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền tải xuống tài liệu này');
                }
            }
        }
    }

    // Dynamic Watermark & Conversion Logic
    const ext = path.extname(filePath).toLowerCase();
    let pdfBuffer: Buffer | null = null;
    let isConverted = false;

    if (ext === '.pdf') {
        try {
            pdfBuffer = fs.readFileSync(filePath);
        } catch (e) {
            console.error('Failed to read PDF file:', e);
        }
    } else if (isInline && isConvertibleFile(filePath)) {
        try {
            console.log('On-the-fly converting to PDF for preview:', filePath);
            pdfBuffer = await convertFileToPdf(filePath);
            isConverted = true;
        } catch (e) {
            console.error('On-the-fly conversion failed:', e);
        }
    }

    if (pdfBuffer) {
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
                    const modifiedPdf = await applyWatermark(pdfBuffer, {
                        type: watermarkType || WatermarkType.DRAFT,
                        effectiveDate: doc.effectiveDate || doc.createdAt,
                        obsoleteDate: doc.updatedAt,
                        departmentName: doc.department?.name,
                        visibility: doc.visibility
                    });

                    res.setHeader('Content-Type', 'application/pdf');
                    const fileName = isConverted ? path.basename(filePath).replace(/\.[^/.]+$/, ".pdf") : path.basename(filePath);
                    if (isInline) {
                        res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
                    } else {
                        res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
                    }
                    res.send(Buffer.from(modifiedPdf));
                    return;
                } catch (error) {
                    console.error('Error applying watermark:', error);
                }
            }
        }

        // If no watermark applied but we have a converted PDF buffer, send it anyway
        if (isConverted) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath).replace(/\.[^/.]+$/, ".pdf") + '"');
            res.send(pdfBuffer);
            return;
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
            let canView = isOwner || userPermission ||
                (doc.visibility === 'PUBLIC') ||
                (doc.visibility === 'DEPARTMENT' && (doc.departmentId === user.departmentId || isSupervisory));

            // Also check if user has an active Signature Request (allow viewing to sign)
            if (!canView) {
                const sigReq = await prisma.signatureRequest.findFirst({
                    where: {
                        documentId: doc.id,
                        userId: user.id,
                    }
                });
                if (sigReq) {
                    canView = true;
                }
            }

            if (!canView) {
                throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
            }
        }
    }

    // Dynamic Watermark & Conversion Logic
    const ext = path.extname(filePath).toLowerCase();
    let pdfBuffer: Buffer | null = null;
    let isConverted = false;

    if (ext === '.pdf') {
        try {
            pdfBuffer = fs.readFileSync(filePath);
        } catch (e) {
            console.error('Failed to read PDF file for view:', e);
        }
    } else if (!isChatUpload && isConvertibleFile(filePath)) {
        try {
            console.log('On-the-fly converting to PDF for view:', filePath);
            pdfBuffer = await convertFileToPdf(filePath);
            isConverted = true;
        } catch (e) {
            console.error('On-the-fly conversion failed for view:', e);
        }
    }

    if (pdfBuffer) {
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
                    const modifiedPdf = await applyWatermark(pdfBuffer, {
                        type: watermarkType || WatermarkType.DRAFT,
                        effectiveDate: doc.effectiveDate || doc.createdAt,
                        obsoleteDate: doc.updatedAt,
                        departmentName: doc.department?.name,
                        visibility: doc.visibility
                    });

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath).replace(/\.[^/.]+$/, ".pdf") + '"');
                    res.setHeader('Content-Security-Policy', "");
                    res.setHeader('X-Frame-Options', 'ALLOWALL');
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    res.send(Buffer.from(modifiedPdf));
                    return;
                } catch (error) {
                    console.error('Error applying watermark in view:', error);
                }
            }
        }

        // Send converted PDF even if no watermark
        if (isConverted) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath).replace(/\.[^/.]+$/, ".pdf") + '"');
            res.send(pdfBuffer);
            return;
        }
    }

    // Serve file inline (Fallback for non-convertible files or original files)
    res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
    res.setHeader('Content-Security-Policy', ""); // Allow displaying in img tag
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set correct Content-Type based on extension
    const currentExt = path.extname(filePath).toLowerCase();
    if (currentExt === '.png') res.setHeader('Content-Type', 'image/png');
    else if (currentExt === '.jpg' || currentExt === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
    else if (currentExt === '.gif') res.setHeader('Content-Type', 'image/gif');
    else if (currentExt === '.pdf') res.setHeader('Content-Type', 'application/pdf');

    res.sendFile(path.resolve(filePath));
});

export const uploadMiddleware = upload.array('files');

export default {
    uploadFile,
    downloadFile,
    viewFile
};
