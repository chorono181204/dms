import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { categoryService } from '../services';

const createCategory = catchAsync(async (req, res) => {
    const user = req.user as any;
    const body = {
        ...req.body,
        createdBy: user.username,
        updatedBy: user.username,
    };

    if (user.role !== 'ADMIN') {
        body.departmentId = user.departmentId;
    }

    const category = await categoryService.createCategory(body);
    res.status(httpStatus.CREATED).send(category);
});

const getCategories = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['name', 'isActive', 'departmentId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const user = req.user as any;

    if (user.role !== 'ADMIN') {
        (filter as any).departmentId = user.departmentId;
    }

    const result = await categoryService.queryCategories(filter, options);
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
    const body = {
        ...req.body,
        updatedBy: user.username,
    };
    const category = await categoryService.updateCategoryById(req.params.categoryId, body);
    res.send(category);
});

const deleteCategory = catchAsync(async (req, res) => {
    await categoryService.deleteCategoryById(req.params.categoryId);
    res.status(httpStatus.NO_CONTENT).send();
});

export default {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
};
