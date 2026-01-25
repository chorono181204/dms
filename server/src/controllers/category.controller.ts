import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { categoryService } from '../services';

const createCategory = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { isGlobal, departmentIds, parentId, ...rest } = req.body;

    const body: any = {
        ...rest,
        createdBy: user.username,
        updatedBy: user.username,
        isGlobal: isGlobal === true || isGlobal === 'true',
        parentId: parentId ? parseInt(parentId) : null,
    };

    // Department assignment logic
    if (body.isGlobal) {
        // Global: no specific departments
        body.departmentId = null;
    } else if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        // Specific department provided (use the first one as we moved to 1:N)
        body.departmentId = parseInt(departmentIds[0]);
    } else {
        // No departments specified - use user's department
        if (user.departmentId) {
            body.departmentId = user.departmentId;
        } else {
            throw new ApiError(httpStatus.BAD_REQUEST, 'User must belong to a department to create categories');
        }
    }

    const category = await categoryService.createCategory(body);
    res.status(httpStatus.CREATED).send(category);
});

const getCategories = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['name', 'isActive', 'departmentId', 'parentId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    if (user.role !== 'ADMIN') {
        (filter as any).departmentId = user.departmentId;
        (filter as any).createdBy = user.username; // Allow finding own private categories
    } else {
        // Limit query to department if provided in filter, otherwise show all?
        // If admin wants to see "Private" categories of others, we might strictly check departmentId filtering.
        // But the service logic `where.OR` uses filter.departmentId. 
        // If Admin sends NO departmentId, they should see ALL (handled by service if deptId is undefined).
        // If Admin sends departmentId, we filter by that dept OR Global.
    }

    const result = await categoryService.queryCategories(filter, options, user);
    res.send(result);
});

const getCategory = catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.categoryId);
    if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
    }
    res.send(category);
});

const updateCategory = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { isGlobal, departmentIds, departmentId, ...rest } = req.body;

    const categoryId = parseInt(req.params.categoryId);
    const category = await categoryService.getCategoryById(categoryId);
    if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Thư mục không tồn tại');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = category.createdBy === user.username;
    const isManagerOfDept = user.role === 'MANAGER' && category.departmentId === user.departmentId;

    if (!isAdmin && !isOwner && !isManagerOfDept) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền chỉnh sửa thư mục này');
    }

    const body: any = {
        ...rest,
        updatedBy: user.username,
    };

    if (isGlobal !== undefined) {
        body.isGlobal = isGlobal === true || isGlobal === 'true';
    }

    if (body.isGlobal) {
        // If global, set departmentId to null
        body.departmentId = null;
    } else if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        // Use first department from array if provided
        body.departmentId = parseInt(departmentIds[0]);
    } else if (departmentId !== undefined) {
        body.departmentId = departmentId ? parseInt(departmentId) : null;
    }

    const updatedCategory = await categoryService.updateCategoryById(categoryId, body);
    res.send(updatedCategory);
});

const deleteCategory = catchAsync(async (req, res) => {
    const user = req.user as any;
    const categoryId = parseInt(req.params.categoryId);

    const category = await categoryService.getCategoryById(categoryId);
    if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Thư mục không tồn tại');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = category.createdBy === user.username;
    const isManagerOfDept = user.role === 'MANAGER' && category.departmentId === user.departmentId;

    if (!isAdmin && !isOwner && !isManagerOfDept) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền xóa thư mục này');
    }

    console.log(`[CategoryController] Deleting category ID: ${categoryId}`);
    await categoryService.deleteCategoryById(categoryId);
    console.log(`[CategoryController] Deleted category ID: ${categoryId}`);
    res.status(httpStatus.NO_CONTENT).send();
});

// NEW: Hierarchical category endpoints

const getCategoryTree = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { departmentId } = req.query;
    const tree = await categoryService.getCategoryTree(user, undefined, departmentId ? parseInt(departmentId as string) : undefined);
    res.send(tree);
});

const getCategoryBreadcrumbs = catchAsync(async (req, res) => {
    const breadcrumbs = await categoryService.getCategoryBreadcrumbs(req.params.categoryId);
    res.send(breadcrumbs);
});

const getCategoryContents = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { search, isReference, createdBy, departmentId } = req.query; // Extract search, isReference, createdBy, departmentId params
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    const contents = await categoryService.getCategoryContents(
        req.params.categoryId,
        user,
        options,
        search as string,
        isReference as string,
        createdBy as string,
        departmentId ? parseInt(departmentId as string) : undefined // Pass departmentId
    );
    res.send(contents);
});

const moveCategory = catchAsync(async (req, res) => {
    const { newParentId } = req.body;
    const user = req.user as any;

    const category = await categoryService.moveCategory(
        req.params.categoryId,
        newParentId ? parseInt(newParentId) : null,
        user.username
    );
    res.send(category);
});

export default {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    // Hierarchical operations
    getCategoryTree,
    getCategoryBreadcrumbs,
    getCategoryContents,
    moveCategory,
};
