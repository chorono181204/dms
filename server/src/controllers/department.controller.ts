import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { departmentService } from '../services';

const createDepartment = catchAsync(async (req, res) => {
    const user = req.user as any;
    const department = await departmentService.createDepartment({
        ...req.body,
        createdBy: user.username,
        updatedBy: user.username
    });
    res.status(httpStatus.CREATED).send(department);
});

const getDepartments = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['name', 'code']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await departmentService.queryDepartments(filter, options);
    res.send(result);
});

const getDepartment = catchAsync(async (req, res) => {
    const department = await departmentService.getDepartmentById(req.params.departmentId);
    if (!department) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    }
    res.send(department);
});

const updateDepartment = catchAsync(async (req, res) => {
    const user = req.user as any;
    const department = await departmentService.updateDepartmentById(req.params.departmentId, {
        ...req.body,
        updatedBy: user.username
    });
    res.send(department);
});

const deleteDepartment = catchAsync(async (req, res) => {
    await departmentService.deleteDepartmentById(req.params.departmentId);
    res.status(httpStatus.NO_CONTENT).send();
});

export default {
    createDepartment,
    getDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment
};
