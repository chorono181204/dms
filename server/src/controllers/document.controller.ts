import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { documentService } from '../services';
import prisma from '../client';
import fs from 'fs';
import path from 'path';
import { convertDocxToPdf, isDocxFile } from '../services/conversion.service';

import * as versionService from '../services/version.service';

// Helper to save file to G-Drive
const saveDocumentFile = (file: Express.Multer.File, categoryName: string, title: string) => {
    // Target structure: G:\My Drive\DMS\{CategoryName}\Tài liệu
    const targetRoot = 'G:\\My Drive\\DMS';
    const targetDir = path.join(targetRoot, categoryName || 'Chưa phân loại', 'Tài liệu');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Keep original extension
    const ext = path.extname(file.originalname);
    // Sanitize title for filename
    const safeBaseName = title.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ \-_]/g, '_');

    let finalFilename = `${safeBaseName}${ext}`;
    let targetPath = path.join(targetDir, finalFilename);
    let counter = 1;

    // Check for existence and add (n) suffix if needed
    while (fs.existsSync(targetPath)) {
        finalFilename = `${safeBaseName} (${counter})${ext}`;
        targetPath = path.join(targetDir, finalFilename);
        counter++;
    }

    try {
        // Move file
        try {
            fs.renameSync(file.path, targetPath);
        } catch (e: any) {
            if (e.code === 'EXDEV') {
                fs.copyFileSync(file.path, targetPath);
                fs.unlinkSync(file.path);
            } else {
                throw e; // rethrow
            }
        }
        return targetPath;
    } catch (error) {
        console.error('Error saving file:', error);
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to save document file');
    }
};

const createDocument = catchAsync(async (req, res) => {
    const user = req.user as any;

    const cleanBody: any = {
        title: req.body.title,
        code: req.body.code,
        description: req.body.description,
        status: req.body.status || 'DRAFT',
        departmentId: req.body.departmentId ? parseInt(req.body.departmentId) : user.departmentId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
        visibility: req.body.visibility || 'PRIVATE', // Allow DEPARTMENT or PRIVATE
        accessLevel: 'VIEW',
        createdBy: user.username,
        updatedBy: user.username,
        currentVersion: 1 // Init version
    };

    // Handle sharedWithViewers and sharedWithEditors
    let sharedViewers: number[] = [];
    let sharedEditors: number[] = [];

    const parseIds = (input: any): number[] => {
        if (!input) return [];
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed.map((id: any) => parseInt(id)) : [parseInt(parsed)];
        } catch (e) {
            if (Array.isArray(input)) return input.map((id: any) => parseInt(id));
            return [parseInt(input)];
        }
    };

    sharedViewers = parseIds(req.body.sharedWithViewers);
    sharedEditors = parseIds(req.body.sharedWithEditors);

    // Old sharedWith backward compatibility (treat as viewers)
    if (req.body.sharedWith && sharedViewers.length === 0 && sharedEditors.length === 0) {
        sharedViewers = parseIds(req.body.sharedWith);
    }

    const permissionCreates: any[] = [];
    sharedViewers.forEach(uid => permissionCreates.push({ userId: uid, permission: 'VIEW' }));
    sharedEditors.forEach(uid => permissionCreates.push({ userId: uid, permission: 'EDIT' }));

    if (permissionCreates.length > 0) {
        cleanBody.permissions = {
            create: permissionCreates
        };
    }

    let savedFilePath = '';
    let fileSize = 0;

    if (req.file) {
        fileSize = req.file.size;
        let categoryName = 'Chưa phân loại';
        if (cleanBody.categoryId) {
            const category = await prisma.category.findUnique({ where: { id: cleanBody.categoryId } });
            if (category) categoryName = category.name;
        }

        // Auto-convert DOCX to PDF
        let fileToSave = req.file;
        if (isDocxFile(req.file.path)) {
            try {
                console.log('Auto-converting DOCX to PDF:', req.file.originalname);
                const pdfBuffer = await convertDocxToPdf(req.file.path);

                // Create a new file object with PDF data
                const pdfPath = req.file.path.replace(/\.(docx?|DOCX?)$/, '.pdf');
                fs.writeFileSync(pdfPath, pdfBuffer);

                // Update file object
                fileToSave = {
                    ...req.file,
                    path: pdfPath,
                    originalname: req.file.originalname.replace(/\.(docx?|DOCX?)$/, '.pdf'),
                    mimetype: 'application/pdf'
                };

                // Update fileSize for PDF
                const stats = fs.statSync(pdfPath);
                fileSize = stats.size;

                // Delete original DOCX
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                console.log('Conversion successful, saved as PDF');
            } catch (error: any) {
                console.error('DOCX to PDF conversion failed:', error);
                throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lỗi chuyển đổi DOCX sang PDF: ${error.message}`);
            }
        }

        cleanBody.content = saveDocumentFile(fileToSave, categoryName, cleanBody.title);
        savedFilePath = cleanBody.content;
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Missing document file');
    }

    const document = await documentService.createDocument(cleanBody);

    // Create initial version v1
    if (savedFilePath) {
        // We need to copy the file to version storage
        // Version storage: uploads/documents/{id}/{id}_v1.{ext}

        const versionDir = path.join('uploads', 'documents', document.id.toString());
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        const ext = path.extname(savedFilePath);
        const versionFileName = `${document.id}_v1${ext}`; // Simple naming: {id}_v{ver}.{ext}
        const versionPath = path.join(versionDir, versionFileName);

        try {
            fs.copyFileSync(savedFilePath, versionPath);

            await versionService.createVersion(
                document.id,
                1,
                versionPath,
                fileSize,
                'Khởi tạo tài liệu',
                user.username
            );
        } catch (error) {
            console.error('Failed to create initial version file:', error);
            // Non-blocking error?
        }
    }

    res.status(httpStatus.CREATED).send(document);
});

const getDocuments = catchAsync(async (req, res) => {
    let filter = pick(req.query, ['title', 'code', 'status', 'departmentId', 'categoryId', 'createdBy', 'visibility']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    // Google Docs style filtering for non-ADMIN users
    if (user.role !== 'ADMIN') {
        const baseFilter = { ...filter };
        // If a specific createdBy is requested, respect it but it must still be accessible

        filter = {
            AND: [
                baseFilter,
                {
                    OR: [
                        { createdBy: user.username }, // Option 1: Only me (owned)
                        { AND: [{ visibility: 'DEPARTMENT' }, { departmentId: user.departmentId }] }, // Option 2: Same department
                        { permissions: { some: { userId: user.id } } } // Option 3: Explicitly shared with me
                    ]
                }
            ]
        } as any;
    }

    const result = await documentService.queryDocuments(filter, options);
    res.send(result);
});

const getDocument = catchAsync(async (req, res) => {
    const document = await documentService.getDocumentById(req.params.documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    const user = req.user as any;
    if (user.role === 'ADMIN') return res.send(document);

    // Check if user is creator
    if (document.createdBy === user.username) return res.send(document);

    // Check visibility
    if (document.visibility === 'DEPARTMENT' && document.departmentId === user.departmentId) return res.send(document);

    // Check explicit permissions
    const hasPermission = await prisma.documentPermission.findFirst({
        where: {
            documentId: document.id,
            userId: user.id
        }
    });

    if (hasPermission) return res.send(document);

    // Check if user is Manager of the department (for Approval)
    if (user.role === 'MANAGER' && document.departmentId === user.departmentId) return res.send(document);

    // Check if user has a Signature Request (for Signing)
    const hasSignatureRequest = await prisma.signatureRequest.findFirst({
        where: {
            documentId: document.id,
            userId: user.id
        }
    });

    if (hasSignatureRequest) return res.send(document);

    throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
});

const updateDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    const existing = await documentService.getDocumentById(documentId) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission Check for EDIT
    let canEdit = user.role === 'ADMIN' || existing.createdBy === user.username;

    if (!canEdit) {
        // Check visibility accessLevel
        if (existing.visibility === 'DEPARTMENT' && existing.departmentId === user.departmentId && existing.accessLevel === 'EDIT') {
            canEdit = true;
        } else {
            // Check explicit DocumentPermission
            const editPermission = await prisma.documentPermission.findFirst({
                where: {
                    documentId: existing.id,
                    userId: user.id,
                    permission: 'EDIT'
                }
            });
            if (editPermission) canEdit = true;
        }

        if (!canEdit) {
            // Check if user has a pending signature request
            const signingRequest = await prisma.signatureRequest.findFirst({
                where: {
                    documentId: existing.id,
                    userId: user.id,
                    status: 'PENDING'
                }
            });
            if (signingRequest) canEdit = true;
        }
    }

    if (!canEdit) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền chỉnh sửa tài liệu này');
    }

    const updateBody: any = {
        title: req.body.title,
        code: req.body.code,
        description: req.body.description,
        status: req.body.status,
        categoryId: req.body.categoryId,
        visibility: req.body.visibility,
        updatedBy: user.username
    };

    // Remove undefined fields
    Object.keys(updateBody).forEach(key => updateBody[key] === undefined && delete updateBody[key]);

    // Handle sharedWith Update
    // Handle sharedWith updates (Explicit Permissions)
    if ('sharedWith' in req.body || 'sharedWithViewers' in req.body || 'sharedWithEditors' in req.body) {

        const parseIds = (input: any): number[] => {
            if (!input) return [];
            try {
                const parsed = JSON.parse(input);
                return Array.isArray(parsed) ? parsed.map((id: any) => parseInt(id)) : [parseInt(parsed)];
            } catch (e) {
                if (Array.isArray(input)) return input.map((id: any) => parseInt(id));
                return [parseInt(input)];
            }
        };

        let viewers: number[] = [];
        let editors: number[] = [];

        if ('sharedWithViewers' in req.body) viewers = parseIds(req.body.sharedWithViewers);
        if ('sharedWithEditors' in req.body) editors = parseIds(req.body.sharedWithEditors);

        // Backward compatibility: if sharedWith is present but viewers/editors are empty, use sharedWith as viewers
        if ('sharedWith' in req.body && viewers.length === 0 && editors.length === 0) {
            viewers = parseIds(req.body.sharedWith);
        }

        // Transaction to update permissions
        await prisma.$transaction(async (tx) => {
            // Delete existing permissions
            await tx.documentPermission.deleteMany({ where: { documentId: existing.id } });

            const permissionsToCreate: { userId: number, permission: 'VIEW' | 'EDIT' }[] = [];

            viewers.forEach(uid => permissionsToCreate.push({ userId: uid, permission: 'VIEW' }));
            editors.forEach(uid => permissionsToCreate.push({ userId: uid, permission: 'EDIT' }));

            // Create new permissions one by one
            if (permissionsToCreate.length > 0) {
                await Promise.all(
                    permissionsToCreate.map(p =>
                        tx.documentPermission.create({
                            data: {
                                documentId: existing.id,
                                userId: p.userId,
                                permission: p.permission
                            }
                        })
                    )
                );
            }
        });
    }

    // Handle File Update or Rename/Move
    if (req.file) {
        // Auto-convert DOCX to PDF
        let fileToSave = req.file;
        let fileSize = req.file.size;

        if (isDocxFile(req.file.path)) {
            try {
                console.log('Auto-converting DOCX to PDF on update:', req.file.originalname);
                const pdfBuffer = await convertDocxToPdf(req.file.path);

                const pdfPath = req.file.path.replace(/\.(docx?|DOCX?)$/, '.pdf');
                fs.writeFileSync(pdfPath, pdfBuffer);

                const stats = fs.statSync(pdfPath);
                fileSize = stats.size;

                fileToSave = {
                    ...req.file,
                    path: pdfPath,
                    originalname: req.file.originalname.replace(/\.(docx?|DOCX?)$/, '.pdf'),
                    mimetype: 'application/pdf'
                };

                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                console.log('Update conversion successful');
            } catch (error: any) {
                console.error('Update DOCX to PDF conversion failed:', error);
                throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lỗi chuyển đổi DOCX sang PDF: ${error.message}`);
            }
        }

        let categoryName = 'Chưa phân loại';
        const catId = updateBody.categoryId ? parseInt(updateBody.categoryId) : existing?.categoryId;
        if (catId) {
            const category = await prisma.category.findUnique({ where: { id: catId } });
            if (category) categoryName = category.name;
        }
        const title = updateBody.title || existing?.title;
        updateBody.content = saveDocumentFile(fileToSave, categoryName, title || 'unnamed');

        // Increment version
        const nextVersion = (existing.currentVersion || 0) + 1;
        updateBody.currentVersion = nextVersion;

        // Delete old file if different (SKIP THIS if we want to keep it? No, previous logic deleted it.
        // But for version control, we want to KEEP old files potentially?
        // Wait, versions are stored in 'uploads/documents/{id}/...', while main file is in 'G:\My Drive\...'
        // Check `saveDocumentFile` implementation -> it moves the file to G-Drive.
        // So the main file is replaced. The version system keeps copies in `uploads/documents/`.

        // So we still delete old main file from G-Drive if path changed
        if (existing?.content && existing.content.includes('G:\\') && existing.content !== updateBody.content) {
            try {
                if (fs.existsSync(existing.content)) {
                    fs.unlinkSync(existing.content);
                }
            } catch (error) {
                console.error('Error deleting old file:', error);
            }
        }

        // After saving main file, create version copy in G: Drive for safety
        const versionRoot = 'G:\\My Drive\\DMS\\_Backup_Versions';
        const versionDir = path.join(versionRoot, documentId.toString());

        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        const ext = path.extname(updateBody.content);
        const versionFileName = `${documentId}_v${nextVersion}${ext}`;
        const versionPath = path.join(versionDir, versionFileName);

        try {
            fs.copyFileSync(updateBody.content, versionPath);

            // Determine note
            const changeNote = req.body.changeNote || `Cập nhật file bởi ${user.username}`;

            await versionService.createVersion(
                documentId,
                nextVersion,
                versionPath,
                fileSize,
                changeNote,
                user.username
            );

            // Clean up old versions
            await versionService.cleanupOldVersions(documentId);

        } catch (error) {
            console.error('Failed to create version file:', error);
        }

    } else if (existing?.content && existing.content.includes('G:\\')) {
        // Check if Title or Category changed
        const newTitle = updateBody.title || existing.title;
        let newCategoryName = 'Chưa phân loại';
        const catIdForMove = updateBody.categoryId ? parseInt(updateBody.categoryId) : existing.categoryId;

        if (catIdForMove) {
            const category = await prisma.category.findUnique({ where: { id: catIdForMove } });
            if (category) newCategoryName = category.name;
        }

        const titleChanged = updateBody.title && updateBody.title !== existing.title;
        const categoryChanged = updateBody.categoryId && parseInt(updateBody.categoryId) !== existing.categoryId;

        if (titleChanged || categoryChanged) {
            try {
                const oldPath = existing.content;
                if (fs.existsSync(oldPath)) {
                    const targetRoot = 'G:\\My Drive\\DMS';
                    const targetDir = path.join(targetRoot, newCategoryName, 'Tài liệu');

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }

                    const ext = path.extname(oldPath);
                    const safeBaseName = newTitle.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ \-_]/g, '_');

                    let newFilename = `${safeBaseName}${ext}`;
                    let newPath = path.join(targetDir, newFilename);
                    let counter = 1;

                    while (fs.existsSync(newPath) && oldPath !== newPath) {
                        newFilename = `${safeBaseName} (${counter})${ext}`;
                        newPath = path.join(targetDir, newFilename);
                        counter++;
                    }

                    // Rename
                    if (oldPath !== newPath) {
                        try {
                            fs.renameSync(oldPath, newPath);
                            updateBody.content = newPath;
                        } catch (e: any) {
                            if (e.code === 'EXDEV') {
                                fs.copyFileSync(oldPath, newPath);
                                fs.unlinkSync(oldPath);
                                updateBody.content = newPath;
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error renaming/moving document file:', error);
            }
        }
    }

    // CRITICAL: Force update status to SIGNED
    try {
        const updateResult = await prisma.signatureRequest.updateMany({
            where: {
                documentId: Number(documentId),
                userId: Number(user.id),
                status: 'PENDING'
            },
            data: {
                status: 'SIGNED',
                signedAt: new Date()
            }
        });
        console.log(`Updated ${updateResult.count} signature requests to SIGNED for doc ${documentId} user ${user.id}`);
    } catch (err) {
        console.error('Error updating signature request status:', err);
    }

    const updatedDocument = await documentService.updateDocumentById(documentId, updateBody);
    res.send(updatedDocument);
});

const deleteDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await documentService.getDocumentById(req.params.documentId) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.createdBy !== user.username) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Chỉ quản trị viên hoặc người tạo mới có quyền xóa tài liệu này');
    }

    // Delete physical file
    if (existing?.content && existing.content.includes('G:\\') && fs.existsSync(existing.content)) {
        try {
            fs.unlinkSync(existing.content);
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }

    await documentService.deleteDocumentById(req.params.documentId);
    res.status(httpStatus.NO_CONTENT).send();
});

const getPdfVersion = catchAsync(async (req, res) => {
    const document = await documentService.getDocumentById(req.params.documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission check (same as getDocument)
    const user = req.user as any;
    if (user.role !== 'ADMIN') {
        if (document.createdBy !== user.username) {
            if (document.visibility !== 'PUBLIC') {
                if (document.visibility !== 'DEPARTMENT' || document.departmentId !== user.departmentId) {
                    const hasPermission = await prisma.documentPermission.findFirst({
                        where: { documentId: document.id, userId: user.id }
                    });
                    if (!hasPermission) {
                        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập tài liệu này');
                    }
                }
            }
        }
    }

    // Check if file exists
    if (!document.content || !fs.existsSync(document.content)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document file not found');
    }

    // If already PDF, just send it
    if (path.extname(document.content).toLowerCase() === '.pdf') {
        const pdfBuffer = fs.readFileSync(document.content);
        res.setHeader('Content-Type', 'application/pdf');
        const safeFilename = document.title.replace(/["\r\n]/g, '').substring(0, 200);
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}.pdf"`);
        res.send(pdfBuffer);
        return;
    }

    // If DOCX, convert to PDF
    if (isDocxFile(document.content)) {
        try {
            const pdfBuffer = await convertDocxToPdf(document.content);
            res.setHeader('Content-Type', 'application/pdf');
            const safeFilename = document.title.replace(/["\r\n]/g, '').substring(0, 200);
            res.setHeader('Content-Disposition', `inline; filename="${safeFilename}.pdf"`);
            res.send(pdfBuffer);
        } catch (error: any) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lỗi chuyển đổi DOCX sang PDF: ${error.message}`);
        }
        return;
    }

    // Unsupported file type
    throw new ApiError(httpStatus.BAD_REQUEST, 'Chỉ hỗ trợ file PDF và DOCX');
});

const getPendingApprovals = catchAsync(async (req, res) => {
    const user = req.user as any;
    const filter: any = {
        status: 'PENDING',
        // Don't show documents created by the current user
        createdBy: { not: user.username }
    };

    // If not ADMIN, only show documents in user's department
    if (user.role !== 'ADMIN') {
        filter.departmentId = user.departmentId;
    }

    const documents = await prisma.document.findMany({
        where: filter,
        include: {
            department: { select: { name: true } },
            category: { select: { name: true } },
            // Include creator info
        },
        orderBy: { updatedAt: 'desc' }
    });

    res.send(documents);
});

const approveDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    const { comment } = req.body;

    const document = await documentService.getDocumentById(documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission Check: Admin or anyone in the same department
    console.log('Approval Permission Check:', {
        userRole: user.role,
        userDepartmentId: user.departmentId,
        documentDepartmentId: document.departmentId,
        userDeptType: typeof user.departmentId,
        docDeptType: typeof document.departmentId
    });

    let canApprove = false;
    if (user.role === 'ADMIN') canApprove = true;
    else if (Number(user.departmentId) === Number(document.departmentId)) canApprove = true;

    if (!canApprove) {
        const debugInfo = `Role: ${user.role}, UserDept: ${user.departmentId}, DocDept: ${document.departmentId}`;
        throw new ApiError(httpStatus.FORBIDDEN, `Bạn không có quyền duyệt tài liệu này. Debug: ${debugInfo}`);
    }

    const updated = await prisma.document.update({
        where: { id: documentId },
        data: {
            status: 'APPROVED',
            updatedBy: user.username
        }
    });

    // Log history
    await prisma.documentHistory.create({
        data: {
            documentId,
            action: 'APPROVED',
            description: comment || 'Đã phê duyệt tài liệu',
            createdBy: user.username,
            departmentId: user.departmentId || document.departmentId // Fallback
        }
    });

    res.send(updated);
});

const rejectDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    const { comment } = req.body;

    const document = await documentService.getDocumentById(documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission Check
    let canReject = false;
    if (user.role === 'ADMIN') canReject = true;
    else if (user.role === 'MANAGER' && user.departmentId === document.departmentId) canReject = true;

    if (!canReject) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền từ chối tài liệu này');
    }

    const updated = await prisma.document.update({
        where: { id: documentId },
        data: {
            status: 'REJECTED',
            updatedBy: user.username
        }
    });

    // Log history
    await prisma.documentHistory.create({
        data: {
            documentId,
            action: 'REJECTED',
            description: comment || 'Đã từ chối tài liệu',
            createdBy: user.username,
            departmentId: user.departmentId || document.departmentId
        }
    });

    res.send(updated);
});

const getApprovalHistory = catchAsync(async (req, res) => {
    const user = req.user as any;

    // Get all DocumentHistory records where current user approved or rejected
    const historyRecords = await prisma.documentHistory.findMany({
        where: {
            createdBy: user.username,
            action: { in: ['APPROVED', 'REJECTED'] }
        },
        include: {
            document: {
                include: {
                    department: { select: { name: true } },
                    category: { select: { name: true } }
                }
            }
        },
        orderBy: { id: 'desc' }
    });

    // Map to document format with action info
    const documents = historyRecords.map(record => ({
        ...record.document,
        action: record.action,
        actionDescription: record.description,
        actionedAt: record.id // Using id as timestamp proxy since DocumentHistory doesn't have createdAt
    }));

    res.send(documents);
});

export default {
    createDocument,
    getDocuments,
    getDocument,
    updateDocument,
    deleteDocument,
    getPdfVersion,
    getPendingApprovals,
    approveDocument,
    rejectDocument,
    getApprovalHistory
};
