import { Category, Prisma } from '@prisma/client';
import prisma from '../client';
import fs from 'fs';
import path from 'path';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

// Helper to get upload root (matches multer.ts and document.controller.ts)
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

/**
 * Create a category
 * @param {Object} categoryBody
 * @returns {Promise<Category>}
 */
const createCategory = async (categoryBody: any): Promise<Category> => {
    // Create category in database
    const category = await prisma.category.create({
        data: categoryBody,
    });

    // Create physical folder on disk
    try {
        const root = getUploadRoot();

        // Get department name - use category's department or throw error
        let departmentName: string;
        const deptId = categoryBody.departmentId;

        if (category.isGlobal) {
            departmentName = '_Global';
        } else {
            if (!deptId) {
                // Determine department from user or context if missing? 
                // For now, if not global and no deptId, it's an integrity issue for physical path
                // But maybe we allow it and default to "Uncategorized" or throw
                // Keeping strict for now but allowing Global bypass
                throw new Error('Category must belong to a department or be Global');
            }

            const dept = await prisma.department.findUnique({
                where: { id: deptId }
            });

            if (!dept) {
                throw new Error('Department not found');
            }
            departmentName = dept.name;
        }

        // Build category path recursively
        const categoryPathParts: string[] = [];
        let currentId = category.parentId;
        while (currentId) {
            const cat = await prisma.category.findUnique({ where: { id: currentId } });
            if (cat) {
                categoryPathParts.unshift(cat.name);
                currentId = cat.parentId || 0;
            } else {
                break;
            }
        }
        // Add current category name
        categoryPathParts.push(category.name);

        // Sanitization helper - only remove truly illegal characters
        const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

        const safeDept = sanitize(departmentName);
        const safeCatPath = categoryPathParts.map(sanitize).join(path.sep);

        // Construct full path: ROOT / Dept / Cat / SubCat
        const finalPath = path.join(root, safeDept, safeCatPath);

        console.log('DEBUG FOLDER CREATION:');
        console.log('Root:', root);
        console.log('Dept Name:', departmentName);
        console.log('Safe Dept:', safeDept);
        console.log('Cat Path Parts:', categoryPathParts);
        console.log('Final Path:', finalPath);

        // Create directory
        if (!fs.existsSync(finalPath)) {
            fs.mkdirSync(finalPath, { recursive: true });
            console.log(`Created physical folder: ${finalPath}`);
        }

        // SAVE PATH TO DATABASE
        // Format: Department/Parent/Child (Normalized to forward slashes for consistency)
        const dbPath = [safeDept, ...categoryPathParts.map(sanitize)].join('/');

        await prisma.category.update({
            where: { id: category.id },
            data: { path: dbPath }
        });

        // Return updated category with path
        return { ...category, path: dbPath };
    } catch (error) {
        console.error('Error creating physical folder:', error);
        // Don't throw - category is already created in DB
    }

    return category;
};

/**
 * Query for categories
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {any} user - Current user for permission filtering
 * @returns {Promise<QueryResult>}
 */
/**
 * Query for categories
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {any} user - Current user for permission filtering
 * @returns {Promise<QueryResult>}
 */
const queryCategories = async (filter: any, options: any, user: any) => {
    const page = options.page ? parseInt(options.page, 10) : 1;
    const limit = options.limit ? parseInt(options.limit, 10) : 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (filter.name) {
        where.name = { contains: filter.name };
    }
    if (filter.isActive !== undefined) {
        where.isActive = filter.isActive === 'true' || filter.isActive === true;
    }

    if (filter.parentId !== undefined) {
        if (filter.parentId === 'null') {
            where.parentId = null;
        } else {
            where.parentId = parseInt(filter.parentId);
        }
    }

    // Apply Virtual Folder logic: Only show folders in the visible path
    if (user.role !== 'ADMIN' || filter.createdBy) {
        const visibleIds = await getVisibleCategoryIds(user, filter.createdBy);
        where.id = { in: visibleIds };
    }

    // 2. Documents Filter: Base visibility rules for count
    const docWhere: any = {
        deletedAt: null
    };

    if (filter.createdBy) {
        docWhere.createdBy = filter.createdBy;
    } else if (user.role !== 'ADMIN') {
        docWhere.OR = [
            { createdBy: user.username },
            { visibility: 'PUBLIC' },
            {
                AND: [
                    { visibility: 'DEPARTMENT' },
                    { departmentId: user.departmentId }
                ]
            },
            { permissions: { some: { userId: user.id } } }
        ];
    }

    const [categories, total] = await Promise.all([
        prisma.category.findMany({
            where,
            skip,
            take: limit,
            orderBy: options.sortBy ? { [options.sortBy.split(':')[0]]: options.sortBy.split(':')[1] } : { createdAt: 'desc' },
            include: {
                department: { select: { id: true, name: true } },
                _count: {
                    select: {
                        documents: {
                            where: docWhere
                        },
                        children: true
                    }
                }
            }
        }),
        prisma.category.count({ where })
    ]);

    const resultsWithMetadata = categories.map(folder => {
        const isDirect = user.role === 'ADMIN' ||
            folder.isGlobal ||
            folder.createdBy === user.username ||
            folder.isGlobal ||
            folder.createdBy === user.username ||
            (folder.departmentId === user.departmentId);

        return {
            ...folder,
            isVirtual: !isDirect
        };
    });

    return {
        results: resultsWithMetadata,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
    };
};

/**
 * Get category by id
 * @param {number} id
 * @returns {Promise<Category | null>}
 */
const getCategoryById = async (id: number | string): Promise<Category | null> => {
    return prisma.category.findUnique({
        where: { id: typeof id === 'string' ? parseInt(id) : id },
    });
};

/**
 * Update category by id
 * @param {number} categoryId
 * @param {Object} updateBody
 * @returns {Promise<Category>}
 */
const updateCategoryById = async (categoryId: number | string, updateBody: any): Promise<Category> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Category not found');
    }
    return prisma.category.update({
        where: { id },
        data: updateBody,
    });
};

/**
 * Delete category by id
 * @param {number} categoryId
 * @returns {Promise<Category>}
 */
const deleteCategoryById = async (categoryId: number | string): Promise<Category> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    const category = await getCategoryById(id);
    if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Thư mục không tồn tại');
    }

    // Check if category has children or documents
    const hasChildren = await prisma.category.count({ where: { parentId: id } });
    if (hasChildren > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Không thể xóa thư mục vì còn chứa thư mục con');
    }

    const hasDocuments = await prisma.document.count({ where: { categoryId: id, deletedAt: null } });
    if (hasDocuments > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Không thể xóa thư mục vì còn chứa tài liệu');
    }

    // Also check for soft-deleted documents if we want strict safety?
    const hasAnyDocs = await prisma.document.count({ where: { categoryId: id } });
    if (hasAnyDocs > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Không thể xóa thư mục vì còn chứa tài liệu (bao gồm tài liệu đã xóa)');
    }

    return prisma.category.delete({
        where: { id },
    });
};

// NEW: Hierarchical category operations

/**
 * Get category tree structure
 * @param {any} user - Current user for permission filtering
 * @param {string} [createdBy] - Optional: Filter by owner
 * @param {number} [departmentId] - Optional: Filter by department
 * @returns {Promise<Category[]>} - Tree structure with nested children
 */
const getCategoryTree = async (user: any, createdBy?: string, departmentId?: number): Promise<any[]> => {
    let where: any = {};

    // Apply Virtual Folder logic
    if (user.role !== 'ADMIN' || createdBy) {
        const visibleIds = await getVisibleCategoryIds(user, createdBy);
        where.id = { in: visibleIds };
    }

    // Filter by department if provided
    if (departmentId) {
        where.departmentId = departmentId;
    }

    // Fetch all categories (we'll build tree in memory for better performance)
    const allCategories = await prisma.category.findMany({
        where,
        include: {
            department: { select: { id: true } },
            _count: {
                select: {
                    documents: true,
                    children: true
                }
            }
        },
        orderBy: [
            { order: 'asc' },
            { name: 'asc' }
        ]
    });

    // Build tree structure
    const buildTree = (parentId: number | null): any[] => {
        return allCategories
            .filter(cat => cat.parentId === parentId)
            .map(cat => {
                const isDirect = user.role === 'ADMIN' ||
                    cat.isGlobal ||
                    cat.createdBy === user.username ||
                    (cat.departmentId === user.departmentId);
                return {
                    ...cat,
                    isVirtual: !isDirect,
                    children: buildTree(cat.id)
                };
            });
    };

    return buildTree(null);
};

/**
 * Get breadcrumb path for a category
 * @param {number | string} categoryId
 * @returns {Promise<Category[]>} - Array of categories from root to current
 */
const getCategoryBreadcrumbs = async (categoryId: number | string): Promise<Category[]> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    const breadcrumbs: Category[] = [];

    let current = await getCategoryById(id);
    if (!current) {
        throw new Error('Category not found');
    }

    breadcrumbs.unshift(current);

    while (current.parentId) {
        current = await getCategoryById(current.parentId);
        if (!current) break;
        breadcrumbs.unshift(current);
    }

    return breadcrumbs;
};

/**
 * Helper to get all category IDs visible to a user (including virtual ancestor folders)
 * @param {any} user - Current user
 * @param {string} [createdByFilter] - Optional: Filter by owner (Scoped visibility)
 */
const getVisibleCategoryIds = async (user: any, createdByFilter?: string): Promise<number[]> => {
    // 1. Direct access categories (Owned or Public/Dept if no owner filter)
    const directCategories = await prisma.category.findMany({
        where: user.role === 'ADMIN' ? {} : {
            OR: [
                ...(createdByFilter ? [] : [
                    { isGlobal: true },
                    { departmentId: user.departmentId }
                ]),
                { createdBy: createdByFilter || user.username }
            ]
        },
        select: { id: true }
    });

    // 2. Categories with accessible documents
    // If createdByFilter is provided, we ONLY look for documents created by that user.
    const accessibleDocs = await prisma.document.findMany({
        where: user.role === 'ADMIN' ? (createdByFilter ? { createdBy: createdByFilter } : {}) : {
            OR: [
                { createdBy: createdByFilter || user.username },
                ...(createdByFilter ? [] : [
                    { visibility: 'PUBLIC' },
                    { AND: [{ visibility: 'DEPARTMENT' }, { departmentId: user.departmentId }] },
                    { permissions: { some: { userId: user.id } } }
                ])
            ],
            deletedAt: null
        },
        select: { categoryId: true }
    });

    const leafIds = new Set<number>();
    directCategories.forEach(c => leafIds.add(c.id));
    accessibleDocs.forEach(d => { if (d.categoryId) leafIds.add(d.categoryId); });

    const visibleIds = new Set<number>(leafIds);
    let currentIds = Array.from(leafIds);

    // Ancestor climb: Ensure parent folders are visible even if private
    while (currentIds.length > 0) {
        const parents = await prisma.category.findMany({
            where: { id: { in: currentIds }, parentId: { not: null } },
            select: { parentId: true }
        });
        const parentIds = parents.map(p => p.parentId as number).filter(id => id && !visibleIds.has(id));
        parentIds.forEach(id => visibleIds.add(id));
        currentIds = parentIds;
    }

    return Array.from(visibleIds);
};

/**
 * Get folder contents (sub-folders and documents)
 * @param {number | string} categoryId
 * @param {any} user - Current user for permission filtering
 * @param {any} options - Pagination options
 * @param {string} [search] - Search text
 * @param {string} [isReference] - Filter by reference type ('true' or 'false')
 * @param {string} [createdBy] - Filter by creator username
 * @returns {Promise<any>} - Object with folders and documents
 */
const getCategoryContents = async (categoryId: number | string, user: any, options: any, search?: string, isReference?: string, createdBy?: string, departmentId?: number): Promise<any> => {
    // Handle 'root' or string 'null' as null
    const id = (categoryId === 'root' || categoryId === 'null') ? null : (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId);

    const page = options.page ? parseInt(options.page, 10) : 1;
    const limit = options.limit ? parseInt(options.limit, 10) : 50;
    const skip = (page - 1) * limit;

    // --- Prepare filters ---

    // 1. Folders Filter
    const folderWhere: any = {};

    // Apply Virtual Folder logic: Only show folders in the visible path
    if (user.role !== 'ADMIN' || createdBy) {
        const visibleIds = await getVisibleCategoryIds(user, createdBy);
        folderWhere.id = { in: visibleIds };
    }

    // Filter Folders by Department if provided
    if (departmentId) {
        folderWhere.departmentId = departmentId;
    }

    // 2. Documents Filter: Base visibility rules
    const baseDocumentWhere: any = {
        deletedAt: null
    };

    // Filter by isReference if provided
    if (isReference !== undefined) {
        baseDocumentWhere.isReference = isReference === 'true';
    }

    // Filter by Department if provided
    if (departmentId) {
        baseDocumentWhere.departmentId = departmentId;
    }

    // Permission filter for documents
    if (createdBy) {
        baseDocumentWhere.createdBy = createdBy;
    } else if (user.role !== 'ADMIN') {
        const isSupervisory = user.department?.isSupervisory;

        const orConditions: any[] = [
            { createdBy: user.username },
            { visibility: 'PUBLIC' },
            { permissions: { some: { userId: user.id } } }
        ];

        if (isSupervisory) {
            // Supervisory departments can see ALL internal documents from ANY department
            orConditions.push({ visibility: 'DEPARTMENT' });
        } else {
            // Normal users can only see internal documents from THEIR department
            orConditions.push({
                AND: [
                    { visibility: 'DEPARTMENT' },
                    { departmentId: user.departmentId }
                ]
            });
        }

        baseDocumentWhere.OR = orConditions;
    }

    const documentWhere: any = { ...baseDocumentWhere };

    // --- Search Logic ---
    if (search && search.trim() !== '') {
        if (id === null) {
            // Global Search
            folderWhere.name = { contains: search };
            documentWhere.title = { contains: search };
        } else {
            // Scoped Search (Inside current folder)
            folderWhere.parentId = id;
            folderWhere.name = { contains: search };

            documentWhere.categoryId = id;
            documentWhere.title = { contains: search };
        }
    } else {
        // Normal Navigation
        folderWhere.parentId = id;
        documentWhere.categoryId = id;
    }

    // --- Execute Queries ---

    const [subFolders, documents, totalDocs] = await Promise.all([
        // Get Folders
        prisma.category.findMany({
            where: folderWhere,
            include: {
                department: { select: { id: true, name: true } },
                _count: {
                    select: {
                        documents: {
                            where: baseDocumentWhere
                        },
                        children: true
                    }
                }
            },
            orderBy: [
                { order: 'asc' },
                { name: 'asc' }
            ]
        }),
        // Get Documents
        prisma.document.findMany({
            where: documentWhere,
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                code: true,
                title: true,
                status: true,
                visibility: true,
                accessLevel: true,
                departmentId: true,
                permissions: {
                    select: { userId: true, permission: true }
                },
                createdBy: true,
                createdByName: true,
                updatedAt: true,
                updatedBy: true,
                updatedByName: true,
                effectiveDate: true,
                expirationDate: true,
                isReference: true,
                content: true,
                category: { select: { id: true, name: true } }, // Include category name for context in search results
                department: { select: { id: true, name: true } }
            }
        }),
        // Count Documents
        prisma.document.count({ where: documentWhere })
    ]);

    const foldersWithMetadata = subFolders.map(folder => {
        const isDirect = user.role === 'ADMIN' ||
            folder.isGlobal ||
            folder.createdBy === user.username ||
            (folder.departmentId === user.departmentId);

        return {
            ...folder,
            isVirtual: !isDirect
        };
    });

    return {
        folders: foldersWithMetadata,
        documents: {
            results: documents,
            page,
            limit,
            totalPages: Math.ceil(totalDocs / limit),
            totalResults: totalDocs
        }
    };
};

/**
 * Move category to new parent and update path/level
 * @param {number | string} categoryId
 * @param {number | null} newParentId
 * @param {string} username
 * @returns {Promise<Category>}
 */
const moveCategory = async (categoryId: number | string, newParentId: number | null, username: string): Promise<Category> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;

    // Validate category exists
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Category not found');
    }

    // Prevent moving to itself
    if (newParentId === id) {
        throw new Error('Cannot move category to itself');
    }

    // Prevent circular reference (moving to own descendant)
    if (newParentId) {
        const newParent = await getCategoryById(newParentId);
        if (!newParent) {
            throw new Error('New parent category not found');
        }

        // Check if newParent is a descendant of category
        let current = newParent;
        while (current.parentId) {
            if (current.parentId === id) {
                throw new Error('Cannot move category to its own descendant');
            }
            const parent = await getCategoryById(current.parentId);
            if (!parent) break;
            current = parent;
        }
    }

    // Calculate new level and path
    let newLevel = 0;
    let newPath = category.name;

    if (newParentId) {
        const breadcrumbs = await getCategoryBreadcrumbs(newParentId);
        newLevel = breadcrumbs.length;
        newPath = [...breadcrumbs.map(b => b.name), category.name].join('/');
    }

    // Update category
    const updated = await prisma.category.update({
        where: { id },
        data: {
            parentId: newParentId,
            level: newLevel,
            path: newPath,
            updatedBy: username
        }
    });

    // Recursively update all children's paths and levels
    await updateChildrenPaths(id);

    return updated;
};

/**
 * Helper: Recursively update children paths and levels
 * @param {number} parentId
 */
const updateChildrenPaths = async (parentId: number): Promise<void> => {
    const children = await prisma.category.findMany({
        where: { parentId }
    });

    for (const child of children) {
        const breadcrumbs = await getCategoryBreadcrumbs(child.id);
        const newPath = breadcrumbs.map(b => b.name).join('/');
        const newLevel = breadcrumbs.length - 1;

        await prisma.category.update({
            where: { id: child.id },
            data: {
                path: newPath,
                level: newLevel
            }
        });

        // Recursively update grandchildren
        await updateChildrenPaths(child.id);
    }
};

export default {
    createCategory,
    queryCategories,
    getCategoryById,
    updateCategoryById,
    deleteCategoryById,
    // Hierarchical operations
    getCategoryTree,
    getCategoryBreadcrumbs,
    getCategoryContents,
    moveCategory,
};
