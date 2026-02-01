import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { templateService } from '../services';
import prisma from '../client';
import fs from 'fs';
import path from 'path';

// Helper to get upload root (matches document.controller.ts)
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

// Helper to save file with hierarchical structure (Async, matches Document logic)
const saveTemplateFile = async (file: Express.Multer.File, departmentId: number | undefined, categoryId: number | undefined, name: string) => {
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

    // Sanitization helper
    const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

    const safeDept = sanitize(departmentName);
    const safeCatPath = categoryPathParts.map(sanitize).join(path.sep);

    // Construct full path: ROOT / Dept / Cat / SubCat
    finalPath = path.join(root, safeDept, safeCatPath);

    // Create directory
    if (!fs.existsSync(finalPath)) {
        fs.mkdirSync(finalPath, { recursive: true });
    }

    // Use the provided Name for the filename, keeping original extension
    const ext = path.extname(file.originalname);
    const safeBaseName = sanitize(name);
    // Add timestamp to avoid collisions
    const finalFilename = `${safeBaseName}_${Date.now()}${ext}`;
    const targetPath = path.join(finalPath, finalFilename);

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
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to save template file');
    }
};

const createTemplate = catchAsync(async (req, res) => {
    const user = req.user as any;

    // 1. Sanitize Body for Prisma Template model
    const cleanBody: any = {
        name: req.body.name,
        isActive: req.body.isActive === 'true' || req.body.isActive === true,
        createdBy: user.username,
        updatedBy: user.username,
    };

    if (req.body.categoryId) {
        cleanBody.category = { connect: { id: parseInt(req.body.categoryId as string) } };
    }

    const deptId = req.body.departmentId ? parseInt(req.body.departmentId as string) : user.departmentId;
    if (deptId) {
        cleanBody.department = { connect: { id: deptId } };
    }

    // 2. Handle Content / File
    if (req.file) {
        const catId = req.body.categoryId ? parseInt(req.body.categoryId as string) : undefined;
        // Use async save function
        cleanBody.content = await saveTemplateFile(req.file, deptId, catId, cleanBody.name);
    } else if (req.body.content) {
        cleanBody.content = req.body.content;
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Missing content or file');
    }

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

    const sharedUsers = parseIds(req.body.sharedUserIds);
    const sharedDepartments = parseIds(req.body.sharedDepartmentIds);
    const permissionLevel = req.body.permission || 'VIEW';

    // Handle "All Departments" selection
    if (sharedDepartments.includes(-99) || (req.body.sharedDepartmentIds && req.body.sharedDepartmentIds.includes('all'))) {
        cleanBody.visibility = 'PUBLIC';
    } else {
        cleanBody.visibility = req.body.visibility || 'PRIVATE';
    }
    cleanBody.accessLevel = req.body.accessLevel || 'VIEW';

    const permissionCreates: any[] = [];
    sharedUsers.forEach(uid => {
        if (!isNaN(uid)) permissionCreates.push({ userId: uid, permission: permissionLevel });
    });
    sharedDepartments.forEach(did => {
        if (!isNaN(did) && did !== -99) {
            permissionCreates.push({ departmentId: did, permission: permissionLevel });
        }
    });

    if (permissionCreates.length > 0) {
        cleanBody.permissions = {
            create: permissionCreates
        };
    }

    const template = await templateService.createTemplate(cleanBody);
    res.status(httpStatus.CREATED).send(template);
});

const getTemplates = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['name', 'category', 'isActive']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    if (user.role !== 'ADMIN' && !user.department?.isSupervisory) {
        const baseFilter = { ...filter };
        delete baseFilter.departmentId;

        (filter as any).AND = [
            baseFilter,
            {
                OR: [
                    { createdBy: user.username },
                    { visibility: 'PUBLIC' },
                    { AND: [{ visibility: 'DEPARTMENT' }, { departmentId: user.departmentId || -1 }] },
                    {
                        permissions: {
                            some: {
                                OR: [
                                    { userId: user.id },
                                    { departmentId: user.departmentId || -1 }
                                ]
                            }
                        }
                    }
                ]
            }
        ];
    }

    const result = await templateService.queryTemplates(filter, options);
    res.send(result);
});

const getTemplate = catchAsync(async (req, res) => {
    const template = await templateService.getTemplateById(req.params.templateId);
    if (!template) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
    }

    const user = req.user as any;
    if (user.role === 'ADMIN' || user.department?.isSupervisory) return res.send(template);
    if (template.createdBy === user.username) return res.send(template);
    if (template.visibility === 'PUBLIC') return res.send(template);
    if (template.visibility === 'DEPARTMENT' && template.departmentId === user.departmentId) return res.send(template);

    const hasPermission = await prisma.templatePermission.findFirst({
        where: {
            templateId: template.id,
            OR: [
                { userId: user.id },
                { departmentId: user.departmentId || -1 }
            ]
        }
    });

    if (!hasPermission) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền xem mẫu này');
    }
    res.send(template);
});

const updateTemplate = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await templateService.getTemplateById(req.params.templateId);
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Mẫu không tồn tại');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = existing.createdBy === user.username;
    const isManagerOfDept = user.role === 'MANAGER' && existing.departmentId === user.departmentId;
    const hasEditPermission = (existing as any).permissions?.some((p: any) => Number(p.userId) === Number(user.id) && p.permission === 'EDIT');

    if (!isAdmin && !isOwner && !isManagerOfDept && !hasEditPermission) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền chỉnh sửa mẫu này');
    }

    // 1. Sanitize Update Body - Only include fields in the Template model
    const updateBody: any = {
        updatedBy: user.username
    };

    // Copy allowed basic fields
    ['name', 'visibility', 'accessLevel'].forEach(field => {
        if (req.body[field] !== undefined) updateBody[field] = req.body[field];
    });

    // Handle Boolean
    if (req.body.isActive !== undefined) {
        updateBody.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }

    // Handle Relations
    if (req.body.categoryId !== undefined) {
        if (req.body.categoryId) {
            updateBody.category = { connect: { id: parseInt(req.body.categoryId as string) } };
        } else {
            updateBody.category = { disconnect: true };
        }
    }

    // Handle File Update or Rename/Move
    if (req.file) {
        const rawCatId = updateBody.categoryId !== undefined ?
            (req.body.categoryId ? parseInt(req.body.categoryId as string) : undefined)
            : existing?.categoryId;
        const catId = rawCatId === null ? undefined : rawCatId;
        const deptId = existing.departmentId === null ? undefined : existing.departmentId; // Usually dept doesn't change on simple update, assuming logic matches doc

        const name = updateBody.name || existing?.name;

        // Use async save
        updateBody.content = await saveTemplateFile(req.file, deptId, catId, name || 'unnamed');

        // Delete old file if it's different (e.g., changed extension .docx -> .pdf)
        if (existing?.content && existing.content.includes('G:\\') && existing.content !== updateBody.content) {
            try {
                if (fs.existsSync(existing.content)) {
                    fs.unlinkSync(existing.content);
                }
            } catch (error) {
                console.error('Error deleting old file:', error);
            }
        }
    } else if (existing?.content && existing.content.includes('G:\\')) {
        // --- MOVE LOGIC (Matches Document Controller) ---
        const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

        const newName = updateBody.name || existing.name;
        // Parse IDs safely
        const targetCatId = req.body.categoryId !== undefined ?
            (req.body.categoryId ? parseInt(req.body.categoryId) : undefined)
            : existing.categoryId;
        // Templates usually don't facilitate department change via simple update, but if they did:
        const targetDeptId = existing.departmentId === null ? undefined : existing.departmentId;

        // Detect Changes
        const nameChanged = req.body.name && req.body.name !== existing.name;
        const categoryChanged = req.body.categoryId !== undefined && Number(req.body.categoryId) !== existing.categoryId;
        // const deptChanged = ...

        if (nameChanged || categoryChanged) {
            try {
                const oldPath = existing.content;
                if (fs.existsSync(oldPath)) {
                    // 1. Determine Root
                    const root = getUploadRoot();

                    // 2. Resolve Target Path
                    let relativePath = '';
                    let departmentName = 'General';

                    if (targetDeptId) {
                        const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
                        if (dept) departmentName = dept.name;
                    }

                    if (targetCatId) {
                        // Re-fetch hierarchy for target category
                        let categoryPathParts: string[] = [];
                        let currentId = targetCatId;
                        while (currentId) {
                            const cat = await prisma.category.findUnique({ where: { id: currentId } });
                            if (cat) {
                                categoryPathParts.unshift(cat.name);
                                currentId = cat.parentId || 0;
                            } else {
                                break;
                            }
                        }
                        relativePath = [sanitize(departmentName), ...categoryPathParts.map(sanitize)].join(path.sep);
                    } else {
                        relativePath = sanitize(departmentName);
                    }

                    // 3. Construct Full Path
                    const targetDir = path.join(root, relativePath);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }

                    // 4. New Filename
                    const ext = path.extname(oldPath);
                    const safeBaseName = sanitize(newName);
                    const newFilename = `${safeBaseName}_${Date.now()}${ext}`; // Add timestamp
                    const newPath = path.join(targetDir, newFilename);

                    // 5. Execute Move
                    if (oldPath !== newPath) {
                        try {
                            fs.renameSync(oldPath, newPath);
                            updateBody.content = newPath;
                        } catch (e: any) {
                            if (e.code === 'EXDEV') {
                                fs.copyFileSync(oldPath, newPath);
                                fs.unlinkSync(oldPath);
                            } else {
                                throw e;
                            }
                        }
                        updateBody.content = newPath;
                    }

                }
            } catch (error) {
                console.error('Error renaming/moving file:', error);
            }
        }
    }

    // Handle permissions updates
    if ('sharedUserIds' in req.body || 'sharedDepartmentIds' in req.body) {
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

        const sharedUsers = parseIds(req.body.sharedUserIds);
        const sharedDepartments = parseIds(req.body.sharedDepartmentIds);
        const permissionLevel = req.body.permission || 'VIEW';

        if (sharedDepartments.includes(-99) || (req.body.sharedDepartmentIds && req.body.sharedDepartmentIds.includes('all'))) {
            updateBody.visibility = 'PUBLIC';
        } else if (req.body.visibility) {
            updateBody.visibility = req.body.visibility;
        }

        await prisma.$transaction(async (tx) => {
            await tx.templatePermission.deleteMany({ where: { templateId: existing.id } });

            const permissionsToCreate: any[] = [];
            sharedUsers.forEach(uid => {
                if (!isNaN(uid)) permissionsToCreate.push({ userId: uid, permission: permissionLevel });
            });
            sharedDepartments.forEach(did => {
                if (!isNaN(did) && did !== -99) {
                    permissionsToCreate.push({ departmentId: did, permission: permissionLevel });
                }
            });

            if (permissionsToCreate.length > 0) {
                await Promise.all(
                    permissionsToCreate.map(p =>
                        tx.templatePermission.create({
                            data: {
                                templateId: existing.id,
                                userId: p.userId,
                                departmentId: p.departmentId,
                                permission: p.permission
                            }
                        })
                    )
                );
            }
        });
    }

    const template = await templateService.updateTemplateById(req.params.templateId, updateBody);
    res.send(template);
});

const deleteTemplate = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await templateService.getTemplateById(req.params.templateId);
    if (!existing) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Mẫu không tồn tại');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = existing.createdBy === user.username;
    const isManagerOfDept = user.role === 'MANAGER' && existing.departmentId === user.departmentId;

    if (!isAdmin && !isOwner && !isManagerOfDept) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền xóa mẫu này');
    }
    // Delete physical file if exists
    if (existing?.content && existing.content.includes('G:\\') && fs.existsSync(existing.content)) {
        try {
            fs.unlinkSync(existing.content);
        } catch (error) {
            console.error('Error deleting file:', error);
            // We continue to delete the record even if file deletion fails, 
            // or we could throw? better to continue but log it.
        }
    }

    await templateService.deleteTemplateById(req.params.templateId);
    res.status(httpStatus.NO_CONTENT).send();
});

export default {
    createTemplate,
    getTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate
};
