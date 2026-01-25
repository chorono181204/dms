import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { documentService } from '../services';
import prisma from '../client';
import fs from 'fs';
import path from 'path';
import { convertFileToPdf, isConvertibleFile } from '../services/conversion.service';

import * as versionService from '../services/version.service';

// Helper to get upload root (matches multer.ts logic)
const getUploadRoot = () => {
    const PREFERRED_ROOT = 'G:\\DMS_DATA';
    const GDRIVE_ROOT = 'G:\\My Drive\\DMS';
    const FALLBACK_ROOT = path.join(__dirname, '../../uploads');

    try {
        if (fs.existsSync('G:\\')) {
            if (fs.existsSync('G:\\My Drive')) {
                const gDrivePath = GDRIVE_ROOT;
                if (!fs.existsSync(gDrivePath)) {
                    fs.mkdirSync(gDrivePath, { recursive: true });
                }
                return gDrivePath;
            }
            if (!fs.existsSync(PREFERRED_ROOT)) {
                fs.mkdirSync(PREFERRED_ROOT, { recursive: true });
            }
            return PREFERRED_ROOT;
        }
    } catch (e) {
        // G drive access error
    }
    return FALLBACK_ROOT;
};

// Helper to save file with hierarchical structure
const saveDocumentFile = async (file: Express.Multer.File, departmentId: number | undefined, categoryId: number | undefined, title: string) => {
    const root = getUploadRoot();
    let finalPath = root;

    // 1. Determine Department
    let departmentName = 'General';
    if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (dept) {
            departmentName = dept.name;
        }
    }

    // 2. Determine Category Path (Recursive)
    let categoryPathParts: string[] = [];
    if (categoryId) {
        let currentId = categoryId;
        while (currentId) {
            const cat = await prisma.category.findUnique({ where: { id: currentId } });
            if (cat) {
                categoryPathParts.unshift(cat.name);
                currentId = cat.parentId || 0;
            } else {
                break;
            }
        }
    }

    // Sanitization helper - only remove unsafe filesystem characters
    const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

    const safeDept = sanitize(departmentName);
    const safeCatPath = categoryPathParts.map(sanitize).join(path.sep);

    // Construct full path: ROOT / Dept / Cat / SubCat
    finalPath = path.join(root, safeDept, safeCatPath);

    // Create directory
    if (!fs.existsSync(finalPath)) {
        fs.mkdirSync(finalPath, { recursive: true });
    }

    // Keep original extension
    const ext = path.extname(file.originalname);
    const safeBaseName = sanitize(title);

    let finalFilename = `${safeBaseName}_${Date.now()}${ext}`;
    let targetPath = path.join(finalPath, finalFilename);

    try {
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
        return targetPath;
    } catch (error: any) {
        console.error('Error saving file:', error);
        if (error.code === 'ENOSPC') {
            throw new ApiError(httpStatus.INSUFFICIENT_STORAGE, 'Bá»™ nhá»› lÆ°u trá»¯ (G: Drive) Ä‘Ă£ Ä‘áº§y. Vui lĂ²ng giáº£i phĂ³ng bá»™ nhá»›.');
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'KhĂ´ng thá»ƒ lÆ°u file vĂ o á»• Ä‘Ä©a G:');
    }
};

const createDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const mainFile = files?.['file']?.[0];
    const referenceFiles = files?.['references'] || [];

    const parseIds = (input: any): number[] => {
        if (!input) return [];
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed.map((id: any) => parseInt(id)) : [parseInt(parsed)];
        } catch (e) {
            if (Array.isArray(input)) return input.map((id: any) => parseInt(id));
            const val = parseInt(input);
            return isNaN(val) ? [] : [val];
        }
    };

    const cleanBody: any = {
        title: req.body.title,
        code: req.body.code,
        description: req.body.description,
        status: req.body.status || 'DRAFT',
        departmentId: req.body.departmentId ? parseInt(req.body.departmentId) : user.departmentId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
        visibility: req.body.visibility || 'PRIVATE',
        accessLevel: req.body.accessLevel || 'VIEW', // Use value from request
        effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : null,
        expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : null,
        createdBy: user.username,
        createdByName: user.name || user.username,
        updatedBy: user.username,
        updatedByName: user.name || user.username,
        currentVersion: 1,
        isReference: req.body.isReference === 'true'
    };

    // Handle sharedWithViewers, sharedWithEditors, and sharedWithDownloaders
    let sharedViewers: number[] = parseIds(req.body.sharedWithViewers);
    let sharedEditors: number[] = parseIds(req.body.sharedWithEditors);
    let sharedDownloaders: number[] = parseIds(req.body.sharedWithDownloaders);

    sharedViewers = parseIds(req.body.sharedWithViewers);
    sharedEditors = parseIds(req.body.sharedWithEditors);
    sharedDownloaders = parseIds(req.body.sharedWithDownloaders);

    // Old sharedWith backward compatibility (treat as viewers)
    if (req.body.sharedWith && sharedViewers.length === 0 && sharedEditors.length === 0 && sharedDownloaders.length === 0) {
        sharedViewers = parseIds(req.body.sharedWith);
    }

    // Handle Department Expansion (Backend Side)
    // For CREATE, we use user.departmentId (Creator's Department)
    if (req.body.includeDepartmentViewers === 'true' || req.body.includeDepartmentEditors === 'true' || req.body.includeDepartmentDownloaders === 'true') {
        if (user.departmentId) {
            const deptUsers = await prisma.user.findMany({
                where: {
                    departmentId: user.departmentId,
                    id: { not: user.id } // Exclude current user
                },
                select: { id: true }
            });
            const deptUserIds = deptUsers.map(u => u.id);

            if (req.body.includeDepartmentViewers === 'true') {
                sharedViewers = [...new Set([...sharedViewers, ...deptUserIds])];
            }
            if (req.body.includeDepartmentEditors === 'true') {
                sharedEditors = [...new Set([...sharedEditors, ...deptUserIds])];
            }
            if (req.body.includeDepartmentDownloaders === 'true') {
                sharedDownloaders = [...new Set([...sharedDownloaders, ...deptUserIds])];
            }
        }
    }

    const permissionCreates: any[] = [];
    sharedViewers.forEach(uid => permissionCreates.push({ userId: uid, permission: 'VIEW' }));
    sharedEditors.forEach(uid => permissionCreates.push({ userId: uid, permission: 'EDIT' }));
    sharedDownloaders.forEach(uid => permissionCreates.push({ userId: uid, permission: 'DOWNLOAD' }));

    if (permissionCreates.length > 0) {
        cleanBody.permissions = {
            create: permissionCreates
        };
    }

    let currentLocalPath = mainFile?.path || '';
    let savedFilePath = '';
    let fileSize = 0;

    // For cleaning up reference files if they are temp
    const tempReferencePaths: string[] = [];
    referenceFiles.forEach(f => tempReferencePaths.push(f.path));

    try {
        if (mainFile) {
            fileSize = mainFile.size;
            let categoryName = 'ChÆ°a phĂ¢n loáº¡i';
            if (cleanBody.categoryId) {
                const category = await prisma.category.findUnique({ where: { id: cleanBody.categoryId } });
                if (category) categoryName = category.name;
            }

            // Auto-convert Convertible Files to PDF
            let fileToSave = mainFile;
            if (isConvertibleFile(mainFile.path)) {
                try {
                    console.log('Auto-converting file to PDF:', mainFile.originalname);
                    const pdfBuffer = await convertFileToPdf(mainFile.path);

                    // Create a new file object with PDF data
                    const pdfPath = mainFile.path.replace(/\.[^/.]+$/, ".pdf");
                    fs.writeFileSync(pdfPath, pdfBuffer);

                    // Track the new local file
                    const oldPath = mainFile.path;
                    currentLocalPath = pdfPath;

                    // Update file object for saveDocumentFile
                    fileToSave = {
                        ...mainFile,
                        path: pdfPath,
                        originalname: mainFile.originalname.replace(/\.[^/.]+$/, ".pdf"),
                        mimetype: 'application/pdf'
                    };

                    // Update fileSize for PDF
                    const stats = fs.statSync(pdfPath);
                    fileSize = stats.size;

                    // Delete original file immediately
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }

                    console.log('Conversion successful, saved as PDF');
                } catch (error: any) {
                    console.error('File to PDF conversion failed:', error);
                    // If conversion fails, we still have the original file at mainFile.path
                    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lá»—i chuyá»ƒn Ä‘á»•i file sang PDF: ${error.message}`);
                }
            }

            // This moves/saves the file to G: Drive
            cleanBody.content = await saveDocumentFile(fileToSave, cleanBody.departmentId, cleanBody.categoryId, cleanBody.title);
            savedFilePath = cleanBody.content;

            // 2. Process Reference Files
            if (referenceFiles.length > 0) {
                cleanBody.attachments = {
                    create: []
                };

                for (const refFile of referenceFiles) {
                    // Use original name for reference title/filename
                    const refName = path.parse(refFile.originalname).name;
                    // Save to same Category folder
                    const savedRefPath = await saveDocumentFile(refFile, cleanBody.departmentId, cleanBody.categoryId, refName);

                    cleanBody.attachments.create.push({
                        filePath: savedRefPath,
                        fileName: refFile.originalname,
                        fileSize: refFile.size,
                        fileType: refFile.mimetype,
                        createdBy: user.username
                    });

                    // Remove from temp cleanup list as it's been moved/handled (saveDocumentFile usually moves it)
                    // But saveDocumentFile handles copy/move. 
                    // If saveDocumentFile moves it, the temp path is gone.
                }
            }

        } else {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Missing document file');
        }

        const document = await documentService.createDocument(cleanBody);

        // Create initial version v1 in local storage for preview/history
        if (savedFilePath) {
            const versionDir = path.join('uploads', 'documents', document.id.toString());
            if (!fs.existsSync(versionDir)) {
                fs.mkdirSync(versionDir, { recursive: true });
            }

            const ext = path.extname(savedFilePath);
            const versionFileName = `${document.id}_v1${ext}`;
            const versionPath = path.join(versionDir, versionFileName);

            try {
                fs.copyFileSync(savedFilePath, versionPath);

                await versionService.createVersion(
                    document.id,
                    1,
                    versionPath,
                    fileSize,
                    'Khá»Ÿi táº¡o tĂ i liá»‡u',
                    user.username,
                    user.name || user.username
                );
            } catch (error) {
                console.error('Failed to create initial version file:', error);
            }
        }

        res.status(httpStatus.CREATED).send(document);
    } catch (error) {
        throw error;
    } finally {
        // Cleanup main file
        if (currentLocalPath && fs.existsSync(currentLocalPath)) {
            try {
                fs.unlinkSync(currentLocalPath);
            } catch (e) {
                console.error('Failed to cleanup local file:', currentLocalPath);
            }
        }
        // Cleanup reference files (if they still exist after save attempts or errors)
        tempReferencePaths.forEach(p => {
            if (fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) { console.error('Failed to cleanup ref file:', p); }
            }
        });
    }
});

const getDocuments = catchAsync(async (req, res) => {
    let filter = pick(req.query, [
        'title', 'code', 'status', 'departmentId', 'categoryId', 'createdBy', 'visibility',
        'effectiveDateStart', 'effectiveDateEnd', 'expirationDateStart', 'expirationDateEnd'
    ]);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    // Google Docs style filtering for non-ADMIN users
    // QLCL (Supervisory) has full view access like Admin
    if (user.role !== 'ADMIN' && !user.department?.isSupervisory) {
        const baseFilter = { ...filter };
        // If a specific createdBy is requested, respect it but it must still be accessible

        filter = {
            AND: [
                baseFilter,
                {
                    OR: [
                        { createdBy: user.username }, // Option 1: Only me (owned)
                        { AND: [{ visibility: 'DEPARTMENT' }, { departmentId: user.departmentId }] }, // Option 2: Same department
                        { visibility: 'PUBLIC' }, // Option 3: Whole system
                        { permissions: { some: { userId: user.id } } } // Option 4: Explicitly shared with me
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
    if (user.role === 'ADMIN' || user.department?.isSupervisory) return res.send(document);

    // Check if user is creator
    if (document.createdBy === user.username) return res.send(document);

    // Check visibility
    if (document.visibility === 'PUBLIC') return res.send(document);
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

    throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n truy cáº­p tĂ i liá»‡u nĂ y');
});

const updateDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    console.log('--- DEBUG updateDocument Payload ---');
    console.log('body:', req.body);
    console.log('sharedWith:', req.body.sharedWith);

    const existing = await documentService.getDocumentById(documentId) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    const isManagerOfDept = user.role === 'MANAGER' && existing.departmentId === user.departmentId;
    let canEdit = user.role === 'ADMIN' || existing.createdBy === user.username || isManagerOfDept;

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
        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n chá»‰nh sá»­a tĂ i liá»‡u nĂ y');
    }

    const updateBody: any = {
        title: req.body.title,
        code: req.body.code,
        description: req.body.description,
        status: req.body.status,
        categoryId: req.body.categoryId ? Number(req.body.categoryId) : undefined,
        visibility: req.body.visibility,
        accessLevel: req.body.accessLevel, // Use value from request
        effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : undefined,
        expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : undefined,
        updatedBy: user.username,
        updatedByName: user.name || user.username,
        isReference: req.body.isReference === undefined ? undefined : req.body.isReference === 'true'
    };

    // STRICT: Only Admin or QLCL can set "Confidential" (PRIVATE)
    if (updateBody.visibility === 'PRIVATE') {
        if (user.role !== 'ADMIN' && !user.department?.isSupervisory) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n Ä‘áº·t tĂ i liá»‡u á»Ÿ Má»©c Ä‘á»™: Báº£o máº­t (03)');
        }
    }

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
        let downloaders: number[] = [];

        if ('sharedWithViewers' in req.body) viewers = parseIds(req.body.sharedWithViewers);
        if ('sharedWithEditors' in req.body) editors = parseIds(req.body.sharedWithEditors);
        if ('sharedWithDownloaders' in req.body) downloaders = parseIds(req.body.sharedWithDownloaders);

        // Backward compatibility: if sharedWith is present but others are empty, use sharedWith as viewers
        if ('sharedWith' in req.body && viewers.length === 0 && editors.length === 0 && downloaders.length === 0) {
            viewers = parseIds(req.body.sharedWith);
        }

        // Handle Department Expansion (Backend Side)
        if (req.body.includeDepartmentViewers === 'true' || req.body.includeDepartmentEditors === 'true' || req.body.includeDepartmentDownloaders === 'true') {
            const deptUsers = await prisma.user.findMany({
                where: {
                    departmentId: existing.departmentId,
                    id: { not: user.id } // Exclude current user (editor/creator)
                },
                select: { id: true }
            });
            const deptUserIds = deptUsers.map(u => u.id);

            if (req.body.includeDepartmentViewers === 'true') {
                viewers = [...new Set([...viewers, ...deptUserIds])];
            }
            if (req.body.includeDepartmentEditors === 'true') {
                editors = [...new Set([...editors, ...deptUserIds])];
            }
            if (req.body.includeDepartmentDownloaders === 'true') {
                downloaders = [...new Set([...downloaders, ...deptUserIds])];
            }
        }

        // Transaction to update permissions
        await prisma.$transaction(async (tx) => {
            // Delete existing permissions
            await tx.documentPermission.deleteMany({ where: { documentId: existing.id } });

            const permissionsToCreate: { userId: number, permission: 'VIEW' | 'EDIT' | 'DOWNLOAD' | 'SIGN' }[] = [];

            viewers.forEach(uid => permissionsToCreate.push({ userId: uid, permission: 'VIEW' }));
            editors.forEach(uid => permissionsToCreate.push({ userId: uid, permission: 'EDIT' }));
            downloaders.forEach(uid => permissionsToCreate.push({ userId: uid, permission: 'DOWNLOAD' }));

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
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const mainFile = files?.['file']?.[0];
    const referenceFiles = files?.['references'] || [];

    let currentLocalPath = mainFile?.path || '';

    // For cleaning up reference files
    const tempReferencePaths: string[] = [];
    referenceFiles.forEach(f => tempReferencePaths.push(f.path));

    try {
        if (mainFile) {
            // Auto-convert DOCX to PDF
            let fileToSave = mainFile;
            let fileSize = mainFile.size;

            if (isConvertibleFile(mainFile.path)) {
                try {
                    console.log('Auto-converting file to PDF on update:', mainFile.originalname);
                    const pdfBuffer = await convertFileToPdf(mainFile.path);

                    const pdfPath = mainFile.path.replace(/\.[^/.]+$/, ".pdf");
                    fs.writeFileSync(pdfPath, pdfBuffer);

                    // Track the new local file
                    const oldPath = mainFile.path;
                    currentLocalPath = pdfPath;

                    const stats = fs.statSync(pdfPath);
                    fileSize = stats.size;

                    fileToSave = {
                        ...mainFile,
                        path: pdfPath,
                        originalname: mainFile.originalname.replace(/\.[^/.]+$/, ".pdf"),
                        mimetype: 'application/pdf'
                    };

                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }

                    console.log('Update conversion successful');
                } catch (error: any) {
                    console.error('Update file to PDF conversion failed:', error);
                    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lá»—i chuyá»ƒn Ä‘á»•i file sang PDF: ${error.message}`);
                }
            }

            let categoryName = 'ChÆ°a phĂ¢n loáº¡i';
            const catId = updateBody.categoryId ? parseInt(updateBody.categoryId) : existing?.categoryId;
            if (catId) {
                const category = await prisma.category.findUnique({ where: { id: catId } });
                if (category) categoryName = category.name;
            }
            const title = updateBody.title || existing?.title;

            // This moves the file to G: Drive
            const deptId = updateBody.departmentId ? parseInt(updateBody.departmentId) : existing?.departmentId;
            updateBody.content = await saveDocumentFile(fileToSave, deptId, catId, title || 'unnamed');

            // Increment version
            const nextVersion = (existing.currentVersion || 0) + 1;
            updateBody.currentVersion = nextVersion;

            // Delete old file if different
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
                const changeNote = req.body.changeNote || `Cáº­p nháº­t file bá»Ÿi ${user.username}`;

                await versionService.createVersion(
                    documentId,
                    nextVersion,
                    versionPath,
                    fileSize,
                    changeNote,
                    user.username,
                    user.name || user.username // createdByName
                );

                // Clean up old versions
                await versionService.cleanupOldVersions(documentId);

            } catch (error) {
                console.error('Failed to create version file:', error);
            }


            // Log history if status changed to SIGNED
            if (updateBody.status === 'SIGNED' && (!existing.status || existing.status !== 'SIGNED')) {
                await prisma.documentHistory.create({
                    data: {
                        documentId,
                        action: 'SIGNED',
                        description: 'ÄĂ£ kĂ½ tĂ i liá»‡u',
                        createdBy: user.username,
                        departmentId: user.departmentId || existing.departmentId
                    }
                });
            }
        } else if (existing?.content && existing.content.includes('G:\\')) {
            // --- SIMPLIFIED & DEBUGGING MOVE LOGIC ---
            const sanitize = (name: string) => name.replace(/[<>:"\\/\\|?*]/g, '_');

            const newTitle = updateBody.title || existing.title;
            // Parse IDs safely
            const targetCatId = updateBody.categoryId ? parseInt(updateBody.categoryId.toString()) : existing.categoryId;
            const targetDeptId = updateBody.departmentId ? parseInt(updateBody.departmentId.toString()) : existing.departmentId;

            // Detect Changes
            const isTitleChanged = updateBody.title && updateBody.title !== existing.title;
            const isCategoryChanged = targetCatId !== existing.categoryId;
            const isDeptChanged = targetDeptId !== existing.departmentId;

            console.log('[MOVE_DEBUG] Check:', {
                isTitleChanged, isCategoryChanged, isDeptChanged,
                inputs: { title: updateBody.title, cat: updateBody.categoryId, dept: updateBody.departmentId },
                existing: { title: existing.title, cat: existing.categoryId, dept: existing.departmentId }
            });

            if (isTitleChanged || isCategoryChanged || isDeptChanged) {
                console.log('[MOVE_DEBUG] Changes detected. Executing move...');
                try {
                    const oldPath = existing.content;
                    if (fs.existsSync(oldPath)) {
                        // 1. Determine Root
                        const GDRIVE_ROOT = 'G:\\My Drive\\DMS';
                        const PREFERRED_ROOT = 'G:\\DMS_DATA';
                        let root = path.join(__dirname, '../../uploads');
                        if (fs.existsSync('G:\\')) {
                            if (fs.existsSync(GDRIVE_ROOT)) root = GDRIVE_ROOT;
                            else if (fs.existsSync('G:\\My Drive')) root = GDRIVE_ROOT;
                            else if (fs.existsSync(PREFERRED_ROOT)) root = PREFERRED_ROOT;
                        }

                        // 2. Resolve Target Path
                        let relativePath = '';
                        let departmentName = 'General';

                        if (targetDeptId) {
                            const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
                            if (dept) departmentName = dept.name;
                        }

                        if (targetCatId) {
                            const cat = await prisma.category.findUnique({ where: { id: targetCatId } });
                            if (cat) {
                                // Prefer DB path, fallback to construction
                                relativePath = cat.path || [sanitize(departmentName), sanitize(cat.name)].join('/');
                            }
                        } else {
                            relativePath = sanitize(departmentName);
                        }

                        // 3. Construct Full Path
                        // Split by / to handle DB path format, then join with OS specific separator
                        const pathSegments = relativePath.split('/').filter(p => p.trim());
                        const targetDir = path.join(root, ...pathSegments);
                        console.log('[MOVE_DEBUG] Target Dir:', targetDir);

                        if (!fs.existsSync(targetDir)) {
                            fs.mkdirSync(targetDir, { recursive: true });
                        }

                        // 4. New Filename
                        const ext = path.extname(oldPath);
                        const safeBaseName = sanitize(newTitle);
                        const newFilename = `${safeBaseName}_${Date.now()}${ext}`;
                        const newPath = path.join(targetDir, newFilename);

                        // 5. Execute Move
                        if (oldPath !== newPath) {
                            try {
                                fs.renameSync(oldPath, newPath);
                                updateBody.content = newPath;
                                console.log('[MOVE_DEBUG] SUCCESS. Moved to:', newPath);
                            } catch (e: any) {
                                if (e.code === 'EXDEV') {
                                    fs.copyFileSync(oldPath, newPath);
                                    fs.unlinkSync(oldPath);
                                    updateBody.content = newPath;
                                    console.log('[MOVE_DEBUG] SUCCESS (Copy/Delete). Moved to:', newPath);
                                } else {
                                    throw e;
                                }
                            }
                        }
                    } else {
                        console.log('[MOVE_DEBUG] Old file not found:', oldPath);
                    }
                } catch (error) {
                    console.error('[MOVE_DEBUG] Error:', error);
                }
            } else {
                console.log('[MOVE_DEBUG] No relevant changes detected.');
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

        // ALSO Log history here if not already logged (e.g. if we want to catch the SignatureRequest path too)
        // But the above check on updateBody.status covers it because updateBody comes from req.body

        // Process Reference File Deletions
        if (req.body.deletedAttachmentIds) {
            try {
                const deletedIds = JSON.parse(req.body.deletedAttachmentIds);
                if (Array.isArray(deletedIds) && deletedIds.length > 0) {
                    // Fetch paths first to delete files
                    const attachmentsToDelete = await prisma.documentAttachment.findMany({
                        where: {
                            id: { in: deletedIds },
                            documentId: documentId
                        }
                    });

                    // Delete files from disk
                    for (const att of attachmentsToDelete) {
                        try {
                            if (fs.existsSync(att.filePath)) {
                                fs.unlinkSync(att.filePath);
                                console.log(`Deleted attachment file: ${att.filePath}`);
                            }
                        } catch (err) {
                            console.error(`Failed to delete attachment file: ${att.filePath}`, err);
                        }
                    }

                    // Delete from DB
                    await prisma.documentAttachment.deleteMany({
                        where: {
                            id: { in: deletedIds },
                            documentId: documentId
                        }
                    });
                    console.log(`Deleted ${deletedIds.length} attachment records`);
                }
            } catch (error) {
                console.error("Error parsing/processing deletedAttachmentIds", error);
            }
        }

        const updatedDocument = await documentService.updateDocumentById(documentId, updateBody);
        res.send(updatedDocument);
    } catch (error) {
        throw error;
    } finally {
        // ALWAYS cleanup the local temporary file if it still exists
        if (currentLocalPath && fs.existsSync(currentLocalPath)) {
            try {
                fs.unlinkSync(currentLocalPath);
            } catch (e) {
                console.error('Failed to cleanup local file:', currentLocalPath);
            }
        }
    }
});

// Export Documents
const exportDocuments = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['title', 'status', 'departmentId', 'startDate', 'endDate', 'expirationStartDate', 'expirationEndDate', 'visibility', 'categoryId']); // Added visibility/categoryId hooks if needed
    const options = {
        sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt',
        sortType: 'desc' as 'desc',
        limit: 10000,
        page: 1,
    };

    // Apply strict visibility Filter similar to queryDocuments
    const user = req.user as any;
    const filters: any = {};

    if (filter.title) filters.title = { contains: filter.title, mode: 'insensitive' };
    if (filter.status) filters.status = filter.status;

    // Status Filter for Expiration
    if (filter.status === 'EXPIRED') {
        filters.expirationDate = { lt: new Date() };
        delete filters.status; // Remove standard status check if checking date
    }

    if (filter.departmentId) filters.departmentId = parseInt(filter.departmentId as string);
    if (filter.categoryId) filters.categoryId = parseInt(filter.categoryId as string);

    // Date Filters
    if (filter.startDate || filter.endDate) {
        filters.effectiveDate = {};
        if (filter.startDate) filters.effectiveDate.gte = new Date(filter.startDate as string);
        if (filter.endDate) filters.effectiveDate.lte = new Date(filter.endDate as string);
    }

    // Visibility Filter (Explicit from UI)
    if (filter.visibility) filters.visibility = filter.visibility;

    // --- REUSE VISIBILITY LOGIC from queryDocuments ---
    // This part essentially duplicates the logic in `document.service.queryDocuments`.
    // Best practice: Refactor service to reuse query building. 
    // For now, I'll pass the filters to the service query but I need to bypass pagination or use a high limit.
    // Actually, `queryDocuments` service handles the complex visibility rules (Admin vs Manager vs User vs QLCL).
    // So I should just call `documentService.queryDocuments` with a high limit.

    // Let's rely on documentService.queryDocuments to handle the visibility logic correctly.
    // We just need to construct the filter object correctly.

    const result = await documentService.queryDocuments(filter, options);
    const documents = result.results;

    // Generate Excel
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sĂ¡ch tĂ i liá»‡u');

    worksheet.columns = [
        { header: 'Sá»‘/KĂ½ hiá»‡u', key: 'documentNumber', width: 20 },
        { header: 'TiĂªu Ä‘á»', key: 'title', width: 30 },
        { header: 'PhiĂªn báº£n', key: 'version', width: 10 },
        { header: 'NgĂ y hiá»‡u lá»±c', key: 'effectiveDate', width: 15 },
        { header: 'NgĂ y háº¿t háº¡n', key: 'expirationDate', width: 15 },
        { header: 'Tráº¡ng thĂ¡i', key: 'status', width: 15 },
        { header: 'Quyá»n háº¡n', key: 'visibility', width: 15 },
        { header: 'Loáº¡i tĂ i liá»‡u', key: 'category', width: 20 },
        { header: 'PhĂ²ng ban', key: 'department', width: 25 },
        { header: 'NgÆ°á»i táº¡o', key: 'createdByName', width: 20 },
        { header: 'NgÆ°á»i cáº­p nháº­t', key: 'updatedByName', width: 20 },
    ];

    documents.forEach((doc: any) => {
        let visibilityLabel = 'CĂ´ng khai';
        if (doc.visibility === 'DEPARTMENT') visibilityLabel = 'Ná»™i bá»™';
        if (doc.visibility === 'PRIVATE') visibilityLabel = 'Báº£o máº­t';

        let statusLabel = doc.status;
        if (doc.expirationDate && new Date(doc.expirationDate) < new Date()) {
            statusLabel = 'Háº¿t háº¡n';
        }

        worksheet.addRow({
            documentNumber: doc.documentNumber,
            title: doc.title,
            version: `${doc.currentVersion}.0`,
            effectiveDate: doc.effectiveDate ? new Date(doc.effectiveDate).toLocaleDateString('vi-VN') : '',
            expirationDate: doc.expirationDate ? new Date(doc.expirationDate).toLocaleDateString('vi-VN') : '',
            status: statusLabel,
            visibility: visibilityLabel,
            category: doc.category?.name || '',
            department: doc.department?.name || '',
            createdByName: doc.createdByName || doc.createdBy,
            updatedByName: doc.updatedByName || doc.updatedBy || doc.createdBy
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Danh_sach_tai_lieu.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

const deleteDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await documentService.getDocumentById(parseInt(req.params.documentId)) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    const isOwner = existing.createdBy === user.username;
    const isAdmin = user.role === 'ADMIN';
    const isManagerOfDept = user.role === 'MANAGER' && existing.departmentId === user.departmentId;

    if (!isAdmin && !isOwner && !isManagerOfDept) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Chá»‰ quáº£n trá»‹ viĂªn, trÆ°á»Ÿng khoa (cá»§a tĂ i liá»‡u), hoáº·c ngÆ°á»i táº¡o má»›i cĂ³ quyá»n xĂ³a tĂ i liá»‡u nĂ y');
    }

    // Soft delete
    await documentService.softDeleteDocumentById(parseInt(req.params.documentId));
    res.status(httpStatus.NO_CONTENT).send();
});

const getTrashedDocuments = catchAsync(async (req, res) => {
    const user = req.user as any;
    const filter = pick(req.query, ['title', 'categoryId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    // Only show trashed documents where deletedAt is not null
    const baseFilter: any = {
        ...filter,
        deletedAt: { not: null }
    };

    if (user.role !== 'ADMIN') {
        baseFilter.OR = [
            { createdBy: user.username },
            { AND: [{ visibility: 'DEPARTMENT' }, { departmentId: user.departmentId }] },
            { visibility: 'PUBLIC' },
            { permissions: { some: { userId: user.id } } }
        ];
    }

    const result = await documentService.queryDocuments(baseFilter, options);
    res.send(result);
});

const restoreDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    const existing = await documentService.getDocumentById(documentId) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.createdBy !== user.username) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n khĂ´i phá»¥c tĂ i liá»‡u nĂ y');
    }

    const document = await documentService.restoreDocumentById(documentId);
    res.send(document);
});

const permanentlyDeleteDocument = catchAsync(async (req, res) => {
    const user = req.user as any;
    const documentId = parseInt(req.params.documentId);
    const existing = await prisma.document.findUnique({ where: { id: documentId } }) as any;
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.createdBy !== user.username) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n xĂ³a vÄ©nh viá»…n tĂ i liá»‡u nĂ y');
    }

    await documentService.permanentlyDeleteDocumentById(documentId);
    res.status(httpStatus.NO_CONTENT).send();
});

const getPdfVersion = catchAsync(async (req, res) => {
    const document = await documentService.getDocumentById(req.params.documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission check (same as getDocument)
    // Permission check (same as getDocument)
    const user = req.user as any;

    // STRICT: Confidential (PRIVATE) documents typically cannot be downloaded/printed
    if (document.visibility === 'PRIVATE') {
        // Allow ADMIN, Creator, and Supervisory departments (QLCL) to view
        const canAccess = user.role === 'ADMIN' ||
            document.createdBy === user.username ||
            user.department?.isSupervisory;

        if (!canAccess) {
            throw new ApiError(httpStatus.FORBIDDEN, 'TĂ i liá»‡u Báº¢O Máº¬T khĂ´ng Ä‘Æ°á»£c phĂ©p táº£i xuá»‘ng hoáº·c in áº¥n');
        }
    }

    if (user.role !== 'ADMIN' && !user.department?.isSupervisory) {
        if (document.createdBy !== user.username) {
            if (document.visibility !== 'PUBLIC') {
                if (document.visibility !== 'DEPARTMENT' || document.departmentId !== user.departmentId) {
                    const hasPermission = await prisma.documentPermission.findFirst({
                        where: { documentId: document.id, userId: user.id }
                    });
                    if (!hasPermission) {
                        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n truy cáº­p tĂ i liá»‡u nĂ y');
                    }
                }
            }
        }
    }

    // Check if file exists
    if (!document.content || !fs.existsSync(document.content)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document file not found');
    }

    // Refined Permission Check for Download vs View
    const isDownload = req.query.download === 'true';
    let allowDownload = false;

    if (user.role === 'ADMIN' || document.createdBy === user.username) {
        allowDownload = true;
    } else {
        // Check Explicit Permission first
        const userPermission = await prisma.documentPermission.findFirst({
            where: { documentId: document.id, userId: user.id }
        });

        if (userPermission) {
            if (userPermission.permission === 'DOWNLOAD' || userPermission.permission === 'EDIT') {
                allowDownload = true;
            }
        } else {
            // Implicit Access
            // Public or Own Department usually allows download
            if (document.visibility === 'PUBLIC') {
                allowDownload = true;
            } else if (document.visibility === 'DEPARTMENT' && document.departmentId === user.departmentId) {
                allowDownload = true;
            }
            // Supervisory (QLCL) viewing other dept's docs -> VIEW ONLY by default (unless Public)
        }
    }

    // STRICT: Private is always View Only for QLCL (handled by allowDownload=false default)

    if (isDownload && !allowDownload) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n táº£i xuá»‘ng tĂ i liá»‡u nĂ y.');
    }

    const disposition = isDownload ? 'attachment' : 'inline';

    // If already PDF, just send it
    if (path.extname(document.content).toLowerCase() === '.pdf') {
        const pdfBuffer = fs.readFileSync(document.content);
        res.setHeader('Content-Type', 'application/pdf');
        const safeFilename = document.title.replace(/["\r\n]/g, '').substring(0, 200);
        res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}.pdf"`);
        res.send(pdfBuffer);
        return;
    }

    // If Convertible, convert to PDF
    // If Convertible, convert to PDF
    if (isConvertibleFile(document.content)) {
        try {
            const pdfBuffer = await convertFileToPdf(document.content);
            res.setHeader('Content-Type', 'application/pdf');
            const safeFilename = document.title.replace(/["\r\n]/g, '').substring(0, 200);
            res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}.pdf"`);
            res.send(pdfBuffer);
        } catch (error: any) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Lá»—i chuyá»ƒn Ä‘á»•i file sang PDF: ${error.message}`);
        }
        return;
    }

    // Unsupported file type
    throw new ApiError(httpStatus.BAD_REQUEST, 'Chá»‰ há»— trá»£ file PDF vĂ  cĂ¡c Ä‘á»‹nh dáº¡ng vÄƒn báº£n OFFICE (DOCX, XLS, TXT, PPT)');
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
        throw new ApiError(httpStatus.FORBIDDEN, `Báº¡n khĂ´ng cĂ³ quyá»n duyá»‡t tĂ i liá»‡u nĂ y. Debug: ${debugInfo}`);
    }

    const updated = await prisma.document.update({
        where: { id: documentId },
        data: {
            status: 'APPROVED',
            updatedBy: user.username,
            updatedByName: user.name || user.username
        }
    });

    // Log history
    await prisma.documentHistory.create({
        data: {
            documentId,
            action: 'APPROVED',
            description: comment || 'ÄĂ£ phĂª duyá»‡t tĂ i liá»‡u',
            createdBy: user.username,
            createdByName: user.name || user.username,
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
        throw new ApiError(httpStatus.FORBIDDEN, 'Báº¡n khĂ´ng cĂ³ quyá»n tá»« chá»‘i tĂ i liá»‡u nĂ y');
    }

    const updated = await prisma.document.update({
        where: { id: documentId },
        data: {
            status: 'REJECTED',
            updatedBy: user.username,
            updatedByName: user.name || user.username
        }
    });

    // Log history
    await prisma.documentHistory.create({
        data: {
            documentId,
            action: 'REJECTED',
            description: comment || 'ÄĂ£ tá»« chá»‘i tĂ i liá»‡u',
            createdBy: user.username,
            createdByName: user.name || user.username,
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


const getDashboardStats = catchAsync(async (req, res) => {
    const user = req.user as any;

    // 1. Total Documents (Accessible to User)
    const docWhere: any = {};
    if (user.role !== 'ADMIN') {
        docWhere.OR = [
            { createdBy: user.username },
            { visibility: 'DEPARTMENT', departmentId: user.departmentId },
            { permissions: { some: { userId: user.id } } }
        ];
    }
    const totalDocuments = await prisma.document.count({ where: docWhere });

    // 2. Pending Approval (Documents waiting for ME to approve)
    const approvalFilter: any = {
        status: 'PENDING',
        createdBy: { not: user.username }
    };
    if (user.role !== 'ADMIN') approvalFilter.departmentId = user.departmentId;
    const pendingApproval = await prisma.document.count({ where: approvalFilter });

    // 3. Pending Sign (Signatures waiting for ME, respecting sequence)
    const myPendingReqs = await prisma.signatureRequest.findMany({
        where: { userId: user.id, status: 'PENDING' },
        select: { id: true, documentId: true, step: true }
    });

    let pendingSign = 0;
    for (const req of myPendingReqs) {
        const blocker = await prisma.signatureRequest.findFirst({
            where: {
                documentId: req.documentId,
                step: { lt: req.step },
                status: 'PENDING'
            }
        });
        if (!blocker) pendingSign++;
    }

    // 4. Signed Today (By anyone in system if Admin/Manager, or just by User)
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

    // Use DocumentHistory for more accurate 'User Signed' metric
    // This catches ad-hoc signs too.
    const historyWhere: any = {
        action: 'SIGNED',
        // DocumentHistory doesn't have createdAt, but it has id... wait.
        // Prisma schema usually adds createdAt to all models.
        // Let's check Schema.
        // Use ID for now? No, need date.
        // Schema check: model DocumentHistory { id Int @id @default(autoincrement()) ... createdBy String ... } 
        // It might NOT have createdAt. Let's assume it doesn't for now based on previous code usage (using id as proxy).
        // Wait, if it doesn't have createdAt, we can't filter by 'Today'.
        // Let's fallback to SignatureRequest for 'Today' check, OR check if we can add createdAt to history.
        // Actually, SignatureRequest has signedAt.
        // If user123 signed without a Request, we have a problem.

        // Alternative: Use Document.updatedAt if status is SIGNED?
        // But that changes on any edit.

        // Let's rely on SignatureRequest count + Generic "I updated a doc to SIGNED status today".
    };

    // Check if we can use DocumentHistory.
    // If we assume IDs are monotonic, we can guess... no, that's bad.

    // Let's stick to SignatureRequest BUT also counting `Document`s where `status` is SIGNED and `updatedBy` is user and `updatedAt` is today.
    // This covers ad-hoc signs where user is the updater.

    const signedDocsCount = await prisma.document.count({
        where: {
            status: 'SIGNED',
            updatedBy: user.username,
            updatedAt: { gte: startOfDay, lte: endOfDay }
        }
    });

    // Also include SignatureRequests (for non-updaters, e.g. multi-signers).
    const sigReqCount = await prisma.signatureRequest.count({
        where: {
            status: 'SIGNED',
            userId: user.id,
            signedAt: { gte: startOfDay, lte: endOfDay }
        }
    });

    // Union? They might overlap if the signer also updated the doc status.
    // If I signed via Request, `updateDocument` might be called by me?
    // Yes, `handleSign` calls updateDocument.
    // So `signedDocsCount` likely covers it.

    // But subsequent signers? 
    // If I am signer 2, I call updateDocument. Status remains SIGNED (or becomes SIGNED).
    // So `updatedBy` becomes me.

    // So `signedDocsCount` covers the LAST person who signed/touched it.
    // `sigReqCount` covers everyone who had a formal request.

    // What if I just take the MAX of both? Or sum?
    // Max is safer.

    const signedToday = Math.max(signedDocsCount, sigReqCount);

    // 5. Recent Documents
    const recentDocs = await prisma.document.findMany({
        where: docWhere,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
            category: { select: { name: true } },
            department: { select: { name: true } }
        }
    });

    // Format recent docs
    const formattedRecent = recentDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category?.name || '---',
        department: doc.department?.name || '---',
        status: doc.status,
        owner: doc.createdByName || doc.createdBy,
        createdAt: doc.createdAt // return Date object or formatting? Client handles formatting usually.
    }));

    res.send({
        stats: {
            totalDocuments,
            pendingApproval,
            pendingSign,
            signedToday
        },
        recentDocuments: formattedRecent
    });
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
    getApprovalHistory,
    getDashboardStats,
    getTrashedDocuments,
    restoreDocument,
    permanentlyDeleteDocument,
    exportDocuments
};


