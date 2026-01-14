import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { templateService } from '../services';
import prisma from '../client';
import fs from 'fs';
import path from 'path';

// Helper to save file to G-Drive
const saveTemplateFile = (file: Express.Multer.File, category: string, name: string) => {
    // Target structure: G:\My Drive\DMS\{category}\Mẫu
    const targetRoot = 'G:\\My Drive\\DMS';
    const targetDir = path.join(targetRoot, category || 'Chưa phân loại', 'Mẫu');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Use the provided Name for the filename, keeping original extension
    const ext = path.extname(file.originalname); // .docx
    const safeName = name.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ \-_]/g, '_');
    const finalFilename = `${safeName}${ext}`;
    const targetPath = path.join(targetDir, finalFilename);

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

    // 1. Sanitize Body
    const cleanBody: any = {
        name: req.body.name,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId as string) : undefined,
        isActive: req.body.isActive === 'true' || req.body.isActive === true, // Convert 'true' string to boolean
        departmentId: req.body.departmentId ? parseInt(req.body.departmentId as string) : user.departmentId,
        createdBy: user.username,
        updatedBy: user.username,
    };

    // 2. Handle Content / File
    if (req.file) {
        let categoryName = 'Chưa phân loại';
        if (cleanBody.categoryId) {
            const category = await prisma.category.findUnique({ where: { id: cleanBody.categoryId } });
            if (category) categoryName = category.name;
        }
        cleanBody.content = saveTemplateFile(req.file, categoryName, cleanBody.name);
    } else if (req.body.content) {
        cleanBody.content = req.body.content;
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Missing content or file');
    }

    const template = await templateService.createTemplate(cleanBody);
    res.status(httpStatus.CREATED).send(template);
});

const getTemplates = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['name', 'category', 'isActive']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    if (user.role !== 'ADMIN') {
        (filter as any).departmentId = user.departmentId;
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
    if (user.role !== 'ADMIN' && template.departmentId !== user.departmentId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
    }
    res.send(template);
});

const updateTemplate = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await templateService.getTemplateById(req.params.templateId);
    if (existing && user.role !== 'ADMIN' && existing.departmentId !== user.departmentId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
    }

    // Sanitize update body
    const updateBody: any = {
        ...req.body,
        updatedBy: user.username
    };

    // Fix types if present
    if (updateBody.isActive !== undefined) {
        updateBody.isActive = updateBody.isActive === 'true' || updateBody.isActive === true;
    }
    if (updateBody.categoryId !== undefined) {
        updateBody.categoryId = updateBody.categoryId ? parseInt(updateBody.categoryId as string) : null;
    }

    // Remove unrelated fields
    delete updateBody.file;

    // Handle File Update or Rename/Move
    if (req.file) {
        // ... (existing upload logic)
        let categoryName = 'Chưa phân loại';
        const catId = updateBody.categoryId || existing?.categoryId;
        if (catId) {
            const category = await prisma.category.findUnique({ where: { id: catId } });
            if (category) categoryName = category.name;
        }
        const name = updateBody.name || existing?.name;

        updateBody.content = saveTemplateFile(req.file, categoryName, name || 'unnamed');

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
        // Check if Name or Category changed
        const newName = updateBody.name || existing.name;
        let newCategoryName = 'Chưa phân loại';
        if (updateBody.categoryId || existing.categoryId) {
            const catId = updateBody.categoryId || existing.categoryId;
            if (catId) {
                const category = await prisma.category.findUnique({ where: { id: catId } });
                if (category) newCategoryName = category.name;
            }
        }

        const nameChanged = updateBody.name && updateBody.name !== existing.name;
        const categoryChanged = updateBody.categoryId && updateBody.categoryId !== existing.categoryId;

        if (nameChanged || categoryChanged) {
            try {
                const oldPath = existing.content;
                if (fs.existsSync(oldPath)) {
                    // Start moving/renaming
                    const targetRoot = 'G:\\My Drive\\DMS';
                    const targetDir = path.join(targetRoot, newCategoryName, 'Mẫu');

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }

                    const ext = path.extname(oldPath);
                    const safeName = newName.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝᴮỴỶỸĐ \-_]/g, '_');
                    const newFilename = `${safeName}${ext}`;
                    const newPath = path.join(targetDir, newFilename);

                    if (oldPath !== newPath) {
                        try {
                            fs.renameSync(oldPath, newPath);
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

    const template = await templateService.updateTemplateById(req.params.templateId, updateBody);
    res.send(template);
});

const deleteTemplate = catchAsync(async (req, res) => {
    const user = req.user as any;
    const existing = await templateService.getTemplateById(req.params.templateId);
    if (existing && user.role !== 'ADMIN' && existing.departmentId !== user.departmentId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
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
